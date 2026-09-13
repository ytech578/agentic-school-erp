const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const school = await prisma.school.findFirst({ where: { code: 'DEMO001' } });
  const sid = school.id;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Staff attendance
  const staffMembers = await prisma.staff.findMany({ where: { schoolId: sid, isActive: true } });
  const staffRecords = staffMembers.map(s => ({
    schoolId: sid,
    staffId: s.id,
    date: today,
    status: Math.random() < 0.92 ? 'PRESENT' : 'ABSENT',
    checkIn: new Date(today.getTime() + (8 * 3600 + 45 * 60) * 1000),
  }));
  const staffRes = await prisma.staffAttendance.createMany({ data: staffRecords, skipDuplicates: true });
  console.log(`✅ Added ${staffRes.count} staff attendance records for today!`);

  const studentCount = await prisma.attendanceRecord.count({ where: { schoolId: sid, date: today } });
  const staffCount = await prisma.staffAttendance.count({ where: { schoolId: sid, date: today } });
  console.log(`Summary: ${studentCount} students and ${staffCount} staff marked for today.`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
