const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function test() {
  try {
    const school = await prisma.school.findFirst();
    const admin = await prisma.user.findFirst({ where: { role: 'SUPER_ADMIN' } });
    const section = await prisma.section.findFirst();
    const students = await prisma.student.findMany({
      where: { enrollments: { some: { sectionId: section.id, status: 'ACTIVE' } } },
      take: 2
    });
    
    if (!students.length) {
      console.log('No students found');
      return;
    }

    const records = students.map(s => ({ studentId: s.id, status: 'PRESENT' }));
    const payload = { sectionId: section.id, date: '2026-08-17', records };

    console.log('Testing payload:', payload);

    const { AttendanceService } = require('./dist/modules/attendance/attendance.service.js');
    const service = new AttendanceService(prisma);
    await service.markAttendance(school.id, admin.id, payload);
    console.log('Success!');
  } catch (e) {
    console.error('Service error:', e);
  } finally {
    await prisma.$disconnect();
  }
}
test();
