import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../core/database/prisma.service';
import { resolveGradeLevel } from '../../core/academic/grade-resolver.util';

export interface IntegrityFinding {
  severity: 'P0' | 'P1' | 'P2';
  entity: string;
  id?: string;
  issue: string;
  context: Record<string, unknown>;
}

export interface IntegrityReport {
  timestamp: string;
  totalRecordsChecked: number;
  clean: boolean;
  findings: IntegrityFinding[];
  summary: {
    P0_count: number;
    P1_count: number;
    P2_count: number;
  };
}

@Injectable()
export class AcademicIntegrityService {
  private readonly logger = new Logger(AcademicIntegrityService.name);

  constructor(private prisma: PrismaService) {}

  async validateIntegrity(schoolIdFilter?: string): Promise<IntegrityReport> {
    const findings: IntegrityFinding[] = [];
    let totalChecked = 0;

    // 1. Audit AcademicYears
    const yearWhere: any = schoolIdFilter ? { schoolId: schoolIdFilter } : {};
    const years = await this.prisma.academicYear.findMany({
      where: yearWhere,
      include: { school: true },
    });
    totalChecked += years.length;
    const activeCountBySchool = new Map<string, number>();

    for (const year of years) {
      if (new Date(year.startDate) >= new Date(year.endDate)) {
        findings.push({
          severity: 'P1',
          entity: 'AcademicYear',
          id: year.id,
          issue: 'startDate is greater than or equal to endDate',
          context: {
            schoolId: year.schoolId,
            startDate: year.startDate,
            endDate: year.endDate,
          },
        });
      }

      if (year.isActive) {
        activeCountBySchool.set(
          year.schoolId,
          (activeCountBySchool.get(year.schoolId) || 0) + 1,
        );
      }
    }

    for (const [schoolId, count] of activeCountBySchool.entries()) {
      if (count > 1) {
        findings.push({
          severity: 'P1',
          entity: 'AcademicYear',
          issue: `Multiple active academic years detected for school (${count} active)`,
          context: { schoolId, activeCount: count },
        });
      }
    }

    const validYearIds = new Set(years.map((y) => y.id));

    // 2. Audit Classes
    const classWhere: any = schoolIdFilter ? { schoolId: schoolIdFilter } : {};
    const classes = await this.prisma.class.findMany({
      where: classWhere,
      include: { academicYear: true },
    });
    totalChecked += classes.length;
    const classKeySet = new Set<string>();

    for (const cls of classes) {
      const key = `${cls.schoolId}:${cls.academicYearId}:${cls.name.trim().toUpperCase()}`;
      if (classKeySet.has(key)) {
        findings.push({
          severity: 'P0',
          entity: 'Class',
          id: cls.id,
          issue: 'Duplicate class name in same school and academic year',
          context: {
            schoolId: cls.schoolId,
            academicYearId: cls.academicYearId,
            name: cls.name,
          },
        });
      }
      classKeySet.add(key);

      if (cls.numericLevel < 1 || cls.numericLevel > 12) {
        findings.push({
          severity: 'P2',
          entity: 'Class',
          id: cls.id,
          issue: `numericLevel (${cls.numericLevel}) out of standard 1-12 bounds`,
          context: { numericLevel: cls.numericLevel },
        });
      }

      if (cls.academicYear && cls.schoolId !== cls.academicYear.schoolId) {
        findings.push({
          severity: 'P0',
          entity: 'Class',
          id: cls.id,
          issue: 'Class schoolId does not match AcademicYear schoolId',
          context: {
            classSchoolId: cls.schoolId,
            yearSchoolId: cls.academicYear.schoolId,
          },
        });
      }
    }

    // 3. Audit Sections
    const sectionWhere: any = schoolIdFilter
      ? { class: { schoolId: schoolIdFilter } }
      : {};
    const sections = await this.prisma.section.findMany({
      where: sectionWhere,
      include: { class: true },
    });
    totalChecked += sections.length;
    const sectionKeySet = new Set<string>();

    for (const sec of sections) {
      if (!sec.class) {
        findings.push({
          severity: 'P0',
          entity: 'Section',
          id: sec.id,
          issue: 'Orphan section: classId does not exist',
          context: { classId: sec.classId },
        });
        continue;
      }

      const key = `${sec.classId}:${sec.name.trim().toUpperCase()}`;
      if (sectionKeySet.has(key)) {
        findings.push({
          severity: 'P0',
          entity: 'Section',
          id: sec.id,
          issue: 'Duplicate section name in same class',
          context: { classId: sec.classId, name: sec.name },
        });
      }
      sectionKeySet.add(key);
    }

    // 4. Audit SchoolSubjectOffering
    const offWhere: any = schoolIdFilter ? { schoolId: schoolIdFilter } : {};
    const offerings = await this.prisma.schoolSubjectOffering.findMany({
      where: offWhere,
      include: { globalSubject: true, curriculumSubject: true },
    });
    totalChecked += offerings.length;
    const offeringKeySet = new Set<string>();

    for (const off of offerings) {
      const key = `${off.schoolId}:${off.academicYearId}:${off.globalSubjectId}:${off.gradeFrom}:${off.gradeTo}`;
      if (offeringKeySet.has(key)) {
        findings.push({
          severity: 'P0',
          entity: 'SchoolSubjectOffering',
          id: off.id,
          issue:
            'Duplicate subject offering for school, academic year, subject, and grade band',
          context: {
            schoolId: off.schoolId,
            academicYearId: off.academicYearId,
            globalSubjectId: off.globalSubjectId,
          },
        });
      }
      offeringKeySet.add(key);

      if (off.gradeFrom > off.gradeTo) {
        findings.push({
          severity: 'P1',
          entity: 'SchoolSubjectOffering',
          id: off.id,
          issue: `Invalid grade band: gradeFrom (${off.gradeFrom}) > gradeTo (${off.gradeTo})`,
          context: { gradeFrom: off.gradeFrom, gradeTo: off.gradeTo },
        });
      }

      if (off.passMarks > off.maxMarks) {
        findings.push({
          severity: 'P1',
          entity: 'SchoolSubjectOffering',
          id: off.id,
          issue: `passMarks (${off.passMarks}) exceeds maxMarks (${off.maxMarks})`,
          context: { passMarks: off.passMarks, maxMarks: off.maxMarks },
        });
      }

      if (!validYearIds.has(off.academicYearId)) {
        findings.push({
          severity: 'P0',
          entity: 'SchoolSubjectOffering',
          id: off.id,
          issue: 'Offering references non-existent academicYearId',
          context: { academicYearId: off.academicYearId },
        });
      }
    }

    // 5. Audit StudentEnrollments
    const enrWhere: any = schoolIdFilter
      ? { student: { schoolId: schoolIdFilter } }
      : {};
    const studentEnrollments = await this.prisma.studentEnrollment.findMany({
      where: enrWhere,
      include: { student: true, section: { include: { class: true } } },
    });
    totalChecked += studentEnrollments.length;
    const activeStudentSessions = new Set<string>();

    for (const enr of studentEnrollments) {
      if (!enr.student) {
        findings.push({
          severity: 'P0',
          entity: 'StudentEnrollment',
          id: enr.id,
          issue: 'Orphan student enrollment: studentId does not exist',
          context: { studentId: enr.studentId },
        });
        continue;
      }

      if (!enr.section?.class) {
        findings.push({
          severity: 'P0',
          entity: 'StudentEnrollment',
          id: enr.id,
          issue:
            'Orphan student enrollment: section or parent class does not exist',
          context: { sectionId: enr.sectionId },
        });
        continue;
      }

      if (enr.student.schoolId !== enr.section.class.schoolId) {
        findings.push({
          severity: 'P0',
          entity: 'StudentEnrollment',
          id: enr.id,
          issue:
            'Cross-school student enrollment: student.schoolId !== section.class.schoolId',
          context: {
            studentSchool: enr.student.schoolId,
            classSchool: enr.section.class.schoolId,
          },
        });
      }

      if (enr.status === 'ACTIVE') {
        const activeKey = `${enr.studentId}:${enr.section.class.academicYearId}`;
        if (activeStudentSessions.has(activeKey)) {
          findings.push({
            severity: 'P1',
            entity: 'StudentEnrollment',
            id: enr.id,
            issue:
              'Student has multiple active enrollments in the same academic year',
            context: {
              studentId: enr.studentId,
              academicYearId: enr.section.class.academicYearId,
            },
          });
        }
        activeStudentSessions.add(activeKey);
      }
    }

    // 6. Audit StudentSubjectEnrollments
    const subEnrWhere: any = schoolIdFilter
      ? { student: { schoolId: schoolIdFilter } }
      : {};
    const subjectEnrollments =
      await this.prisma.studentSubjectEnrollment.findMany({
        where: subEnrWhere,
        include: {
          student: {
            include: {
              enrollments: {
                where: { status: 'ACTIVE' },
                include: { section: { include: { class: true } } },
                take: 1,
              },
            },
          },
          schoolSubjectOffering: true,
        },
      });
    totalChecked += subjectEnrollments.length;

    for (const se of subjectEnrollments) {
      if (!se.student || !se.schoolSubjectOffering) {
        findings.push({
          severity: 'P0',
          entity: 'StudentSubjectEnrollment',
          id: se.id,
          issue: 'Orphan student subject enrollment',
          context: {
            studentId: se.studentId,
            offeringId: se.schoolSubjectOfferingId,
          },
        });
        continue;
      }

      if (se.student.schoolId !== se.schoolSubjectOffering.schoolId) {
        findings.push({
          severity: 'P0',
          entity: 'StudentSubjectEnrollment',
          id: se.id,
          issue: 'Cross-school subject enrollment',
          context: {
            studentSchool: se.student.schoolId,
            offeringSchool: se.schoolSubjectOffering.schoolId,
          },
        });
      }

      if (se.academicYearId !== se.schoolSubjectOffering.academicYearId) {
        findings.push({
          severity: 'P1',
          entity: 'StudentSubjectEnrollment',
          id: se.id,
          issue:
            'Academic year mismatch between subject enrollment and offering',
          context: {
            enrollmentYear: se.academicYearId,
            offeringYear: se.schoolSubjectOffering.academicYearId,
          },
        });
      }

      const activeClass = se.student.enrollments?.[0]?.section?.class;
      if (activeClass) {
        const gradeLevel = resolveGradeLevel(activeClass);

        if (
          gradeLevel < se.schoolSubjectOffering.gradeFrom ||
          gradeLevel > se.schoolSubjectOffering.gradeTo
        ) {
          findings.push({
            severity: 'P1',
            entity: 'StudentSubjectEnrollment',
            id: se.id,
            issue: `Student grade (${gradeLevel}, class "${activeClass.name}") is outside offering grade band (${se.schoolSubjectOffering.gradeFrom}-${se.schoolSubjectOffering.gradeTo})`,
            context: {
              studentGrade: gradeLevel,
              className: activeClass.name,
              gradeFrom: se.schoolSubjectOffering.gradeFrom,
              gradeTo: se.schoolSubjectOffering.gradeTo,
            },
          });
        }
      }
    }

    // 7. Audit TeacherAssignments
    const taWhere: any = schoolIdFilter ? { schoolId: schoolIdFilter } : {};
    const teacherAssignments = await this.prisma.teacherAssignment.findMany({
      where: taWhere,
      include: { staff: true, section: { include: { class: true } } },
    });
    totalChecked += teacherAssignments.length;
    const teacherAssgnKeySet = new Set<string>();

    for (const ta of teacherAssignments) {
      if (!ta.staff || !ta.section?.class) {
        findings.push({
          severity: 'P0',
          entity: 'TeacherAssignment',
          id: ta.id,
          issue: 'Orphan teacher assignment missing staff or section',
          context: { staffId: ta.staffId, sectionId: ta.sectionId },
        });
        continue;
      }

      if (ta.schoolId && ta.staff.schoolId !== ta.schoolId) {
        findings.push({
          severity: 'P0',
          entity: 'TeacherAssignment',
          id: ta.id,
          issue: 'TeacherAssignment schoolId does not match staff.schoolId',
          context: {
            assignmentSchool: ta.schoolId,
            staffSchool: ta.staff.schoolId,
          },
        });
      }

      if (ta.section.class.schoolId !== ta.staff.schoolId) {
        findings.push({
          severity: 'P0',
          entity: 'TeacherAssignment',
          id: ta.id,
          issue:
            'Cross-school teacher assignment: staff school does not match section class school',
          context: {
            staffSchool: ta.staff.schoolId,
            sectionClassSchool: ta.section.class.schoolId,
          },
        });
      }

      const key = `${ta.academicYearId}:${ta.staffId}:${ta.sectionId}:${ta.subjectId || 'NONE'}`;
      if (teacherAssgnKeySet.has(key)) {
        findings.push({
          severity: 'P0',
          entity: 'TeacherAssignment',
          id: ta.id,
          issue: 'Duplicate teacher assignment in same academic year',
          context: {
            academicYearId: ta.academicYearId,
            staffId: ta.staffId,
            sectionId: ta.sectionId,
            subjectId: ta.subjectId,
          },
        });
      }
      teacherAssgnKeySet.add(key);
    }

    const p0 = findings.filter((f) => f.severity === 'P0').length;
    const p1 = findings.filter((f) => f.severity === 'P1').length;
    const p2 = findings.filter((f) => f.severity === 'P2').length;

    return {
      timestamp: new Date().toISOString(),
      totalRecordsChecked: totalChecked,
      clean: findings.length === 0,
      findings,
      summary: {
        P0_count: p0,
        P1_count: p1,
        P2_count: p2,
      },
    };
  }
}
