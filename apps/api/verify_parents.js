const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function verify() {
  const school = await prisma.school.findFirst({ where: { code: 'DEMO001' } });
  const totalStudents = await prisma.student.count({ where: { schoolId: school.id } });
  const parentUsers = await prisma.user.count({ where: { schoolId: school.id, role: 'PARENT' } });
  const linkedGuardians = await prisma.guardian.count({ where: { student: { schoolId: school.id }, userId: { not: null } } });
  const unlinked = await prisma.student.count({ where: { schoolId: school.id, guardians: { none: { userId: { not: null } } } } });
  console.log('=== FINAL VERIFICATION ===');
  console.log(`Total Students:        ${totalStudents}`);
  console.log(`PARENT user accounts:  ${parentUsers}`);
  console.log(`Linked guardians:      ${linkedGuardians}`);
  console.log(`Students WITHOUT parent account: ${unlinked}`);
  console.log(unlinked === 0 ? '\n✅ ALL students have parent accounts!' : `\n⚠️  ${unlinked} students still missing.`);
}
verify().finally(() => prisma.$disconnect());
