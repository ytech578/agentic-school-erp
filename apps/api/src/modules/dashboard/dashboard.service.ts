import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../core/database/prisma.service';

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async getDashboardStats(schoolId: string) {
    const [
      totalStudents,
      totalStaff,
      totalClasses
    ] = await Promise.all([
      this.prisma.user.count({
        where: { schoolId, role: 'STUDENT', status: 'ACTIVE' },
      }),
      this.prisma.user.count({
        where: { schoolId, role: 'TEACHER', status: 'ACTIVE' },
      }),
      this.prisma.class.count({
        where: { schoolId },
      }),
    ]);

    // Mock revenue/attendance for MVP
    const revenue = 450000; 
    const attendance = 94.2;

    return {
      stats: [
        { title: 'Total Students', value: totalStudents.toString(), icon: 'GraduationCap', color: 'var(--info)' },
        { title: 'Total Staff', value: totalStaff.toString(), icon: 'Users', color: 'var(--primary-500)' },
        { title: 'Active Classes', value: totalClasses.toString(), icon: 'BookOpen', color: 'var(--success)' },
        { title: 'Avg. Attendance', value: `${attendance}%`, icon: 'Activity', color: 'var(--warning)' },
      ],
      recentEnrollments: await this.getRecentEnrollments(schoolId),
    };
  }

  private async getRecentEnrollments(schoolId: string) {
    return this.prisma.user.findMany({
      where: { schoolId, role: 'STUDENT' },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 5,
    });
  }

  async getTeacherDashboard(userId: string, schoolId: string) {
    // 1. Get the staff record
    const staff = await this.prisma.staff.findUnique({
      where: { userId },
      include: {
        teacherAssignments: {
          include: {
            section: {
              include: {
                class: true,
                _count: {
                  select: { enrollments: true }
                }
              }
            },
            subject: true,
          }
        }
      }
    });

    if (!staff) {
      return { classes: [] };
    }

    // 2. Format assignments
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const classes = await Promise.all(staff.teacherAssignments.map(async (assignment) => {
      // Check if attendance is marked for this section today
      const attendanceRecord = await this.prisma.attendanceRecord.findFirst({
        where: {
          sectionId: assignment.sectionId,
          date: { gte: today }
        }
      });

      return {
        id: assignment.id,
        className: assignment.section.class.name,
        section: assignment.section.name,
        subject: assignment.subject?.name || 'Class Teacher',
        studentsCount: assignment.section._count.enrollments,
        attendanceMarked: !!attendanceRecord,
      };
    }));

    return { classes };
  }

  async getParentDashboard(userId: string, schoolId: string) {
    // 1. Get guardian records for this user to find their linked students
    const guardians = await this.prisma.guardian.findMany({
      where: { userId },
      include: {
        student: {
          include: {
            enrollments: {
              include: {
                section: {
                  include: { class: true }
                }
              },
              where: { status: 'ACTIVE' },
              take: 1
            },
            attendance: {
              where: {
                date: {
                  gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1) // First day of current month
                }
              }
            },
            feePayments: {
              where: { paymentStatus: { in: ['PENDING', 'OVERDUE', 'PARTIAL'] } }
            },
            user: true
          }
        }
      }
    });

    // 2. Format data for the parent dashboard
    const children = guardians.map((g: any) => {
      const student = g.student;
      const enrollment = student.enrollments[0];
      const className = enrollment 
        ? `${enrollment.section.class.name} - ${enrollment.section.name}` 
        : 'Not Enrolled';

      // Calculate attendance percentage for current month
      const totalDays = student.attendance.length;
      const presentDays = student.attendance.filter((a: any) => a.status === 'PRESENT' || a.status === 'LATE').length;
      const attendancePct = totalDays > 0 ? Math.round((presentDays / totalDays) * 100) : 100;

      // Mock fee calculation (assuming simple aggregation for MVP)
      const pendingFees = student.feePayments.reduce((acc: number, curr: any) => acc + (Number(curr.outstandingAmount) || 0), 0);
      const nextFeeDue = student.feePayments.length > 0 ? student.feePayments[0].paymentDate : new Date();

      return {
        id: student.id,
        name: `${student.user.firstName} ${student.user.lastName}`,
        className,
        attendancePct,
        nextFeeDue: nextFeeDue.toISOString(),
        feeAmount: pendingFees > 0 ? pendingFees : 4500, // Fallback mock amount for MVP visual
      };
    });

    return { children };
  }

  // ─── STUDENT DASHBOARD ───────────────────────────────────────────────────

  async getStudentDashboard(userId: string, schoolId: string) {
    const student = await this.prisma.student.findFirst({
      where: { userId, schoolId },
      include: {
        enrollments: {
          include: {
            section: {
              include: { class: true }
            }
          }
        },
        attendance: {
          orderBy: { date: 'desc' },
          take: 30,
        },
        feePayments: {
          where: { paymentStatus: 'PENDING' },
        }
      }
    });

    if (!student) {
      return { attendancePct: 0, pendingFees: 0, upcomingExams: [], recentMarks: [] };
    }

    const presentCount = student.attendance.filter((a: any) => a.status === 'PRESENT').length;
    const attendancePct = student.attendance.length > 0 ? Math.round((presentCount / student.attendance.length) * 100) : 100;
    
    const pendingFees = student.feePayments.reduce((acc: number, curr: any) => acc + (Number(curr.outstandingAmount) || 0), 0);
    const section = student.enrollments[0]?.section;
    const className = section ? `${section.class.name} ${section.name}` : 'Unassigned';

    return {
      studentInfo: {
        id: student.id,
        admissionNumber: student.admissionNumber,
        className,
        rollNumber: student.enrollments[0]?.rollNumber || 'N/A'
      },
      attendancePct,
      pendingFees: pendingFees > 0 ? pendingFees : 4500, // fallback for MVP visual if 0
      upcomingExams: [
        { id: '1', subject: 'Mathematics', date: '2026-08-20', time: '10:00 AM' },
        { id: '2', subject: 'Science', date: '2026-08-22', time: '10:00 AM' }
      ],
      recentMarks: [
        { subject: 'English', score: 85, maxScore: 100, grade: 'A' },
        { subject: 'History', score: 92, maxScore: 100, grade: 'A+' }
      ]
    };
  }
}
