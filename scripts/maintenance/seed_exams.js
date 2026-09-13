/**
 * SEED SCRIPT 1A — Exams + Student Marks (FIXED)
 * StudentEnrollment has no academicYearId — it links via Section → Class → AcademicYear
 */
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

function randInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function getGrade(pct) {
  if (pct >= 90) return 'A+';
  if (pct >= 80) return 'A';
  if (pct >= 70) return 'B+';
  if (pct >= 60) return 'B';
  if (pct >= 50) return 'C';
  if (pct >= 40) return 'D';
  return 'F';
}
function randMarks(max, isWeak) {
  const base = isWeak ? randInt(Math.floor(max * 0.15), Math.floor(max * 0.45)) : randInt(Math.floor(max * 0.5), max);
  return Math.min(base, max);
}

async function main() {
  console.log('📚 Starting Exam + Marks Seeding (Fixed)...\n');

  const school = await prisma.school.findFirst({ where: { code: 'DEMO001' } });
  const sid = school.id;
  const ay = await prisma.academicYear.findFirst({ where: { schoolId: sid, isActive: true } });
  const adminUser = await prisma.user.findFirst({ where: { schoolId: sid, role: 'SCHOOL_ADMIN' } });

  console.log(`School: ${school.name} | AY: ${ay.name}\n`);

  // Get all classes WITH their subjects and enrollments via sections
  const classes = await prisma.class.findMany({
    where: { schoolId: sid, academicYearId: ay.id },
    include: {
      subjects: { include: { subject: true } },
      sections: {
        include: {
          enrollments: {
            where: { status: 'ACTIVE' },
            select: { studentId: true }
          }
        }
      }
    }
  });

  console.log(`Found ${classes.length} classes`);
  for (const c of classes) {
    const students = c.sections.flatMap(s => s.enrollments.map(e => e.studentId));
    console.log(`  ${c.name}: ${c.subjects.length} subjects, ${students.length} students`);
  }
  console.log('');

  // Delete existing exams first to allow clean re-seed
  const existingExams = await prisma.exam.findMany({ where: { schoolId: sid, academicYearId: ay.id } });
  if (existingExams.length > 0) {
    console.log(`⚠️  Found ${existingExams.length} existing exams — checking for marks...`);
    const markCount = await prisma.studentMark.count();
    if (markCount === 0) {
      console.log('No marks found, cleaning up empty exams...');
      await prisma.examSubject.deleteMany({ where: { exam: { schoolId: sid } } });
      await prisma.exam.deleteMany({ where: { schoolId: sid, academicYearId: ay.id } });
      console.log('Cleaned up.\n');
    }
  }

  const examDefs = [
    { name: 'Unit Test 1', examType: 'UNIT_TEST', startDate: new Date('2026-07-14'), endDate: new Date('2026-07-18'), maxMarks: 25, passMarks: 10 },
    { name: 'Mid-Term Examination', examType: 'MID_TERM', startDate: new Date('2026-08-18'), endDate: new Date('2026-08-25'), maxMarks: 80, passMarks: 32 },
    { name: 'Unit Test 2', examType: 'UNIT_TEST', startDate: new Date('2026-09-01'), endDate: new Date('2026-09-05'), maxMarks: 25, passMarks: 10 },
  ];

  let totalMarks = 0;

  for (const examDef of examDefs) {
    const existing = await prisma.exam.findFirst({
      where: { schoolId: sid, academicYearId: ay.id, name: examDef.name }
    });
    
    let exam;
    if (existing) {
      exam = existing;
      console.log(`⏭️  Using existing exam: ${exam.name}`);
    } else {
      exam = await prisma.exam.create({
        data: {
          schoolId: sid,
          academicYearId: ay.id,
          name: examDef.name,
          examType: examDef.examType,
          startDate: examDef.startDate,
          endDate: examDef.endDate,
          isPublished: true,
          publishedAt: examDef.endDate,
        }
      });
      console.log(`✅ Created Exam: ${exam.name}`);
    }

    let examMarksCount = 0;

    for (const cls of classes) {
      const studentIds = [...new Set(cls.sections.flatMap(s => s.enrollments.map(e => e.studentId)))];
      if (!studentIds.length || !cls.subjects.length) continue;

      for (const classSubject of cls.subjects) {
        // Upsert ExamSubject (create if not exists)
        let examSubject = await prisma.examSubject.findUnique({
          where: { examId_subjectId_classId: { examId: exam.id, subjectId: classSubject.subjectId, classId: cls.id } }
        });
        
        if (!examSubject) {
          examSubject = await prisma.examSubject.create({
            data: {
              examId: exam.id,
              subjectId: classSubject.subjectId,
              classId: cls.id,
              maxMarks: examDef.maxMarks,
              passMarks: examDef.passMarks,
              examDate: new Date(examDef.startDate.getTime() + randInt(0, 4) * 86400000),
              duration: examDef.maxMarks === 25 ? 60 : 180,
            }
          });
        }

        // Check if marks already exist for this examSubject
        const existingMarks = await prisma.studentMark.count({ where: { examSubjectId: examSubject.id } });
        if (existingMarks > 0) continue;

        const marksData = studentIds.map(studentId => {
          const isWeakStudent = Math.random() < 0.12;
          const isAbsent = Math.random() < 0.04;
          const marks = isAbsent ? null : randMarks(examDef.maxMarks, isWeakStudent);
          const pct = marks !== null ? (marks / examDef.maxMarks) * 100 : 0;
          return {
            studentId,
            examSubjectId: examSubject.id,
            marksObtained: marks,
            isAbsent,
            grade: isAbsent ? null : getGrade(pct),
            enteredById: adminUser.id,
            enteredAt: new Date(examDef.endDate.getTime() + randInt(1, 3) * 86400000),
          };
        });

        await prisma.studentMark.createMany({ data: marksData, skipDuplicates: true });
        examMarksCount += marksData.length;
        totalMarks += marksData.length;
      }

      // Generate ReportCards
      const studentIds2 = [...new Set(cls.sections.flatMap(s => s.enrollments.map(e => e.studentId)))];
      const studentTotals = {};
      for (const stId of studentIds2) {
        const stMarks = await prisma.studentMark.findMany({
          where: { studentId: stId, examSubject: { examId: exam.id, classId: cls.id } }
        });
        studentTotals[stId] = stMarks.reduce((sum, m) => sum + (Number(m.marksObtained) || 0), 0);
      }

      const ranked = Object.entries(studentTotals).sort((a, b) => b[1] - a[1]);
      const totalMaxForClass = cls.subjects.length * examDef.maxMarks;

      for (let i = 0; i < ranked.length; i++) {
        const [studentId, totalObtained] = ranked[i];
        const pct = totalMaxForClass > 0 ? (totalObtained / totalMaxForClass) * 100 : 0;
        await prisma.reportCard.upsert({
          where: { studentId_examId: { studentId, examId: exam.id } },
          create: {
            studentId, examId: exam.id,
            totalMarks: totalMaxForClass,
            obtainedMarks: totalObtained,
            percentage: Math.round(pct * 100) / 100,
            rank: i + 1,
            grade: getGrade(pct),
            isPublished: true,
          },
          update: {
            totalMarks: totalMaxForClass,
            obtainedMarks: totalObtained,
            percentage: Math.round(pct * 100) / 100,
            rank: i + 1,
            grade: getGrade(pct),
          }
        });
      }
    }

    console.log(`   → Marks created for ${exam.name}: ${examMarksCount}`);
  }

  console.log(`\n✅ DONE! Total marks seeded: ${totalMarks}`);
}

main().catch(e => { console.error('❌', e); process.exit(1); }).finally(() => prisma.$disconnect());
