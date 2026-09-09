// Check existing guardian data and parent accounts
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function audit() {
  const school = await prisma.school.findFirst({ where: { code: 'DEMO001' } });
  if (!school) { console.log('School not found'); return; }

  // Count students
  const totalStudents = await prisma.student.count({ where: { schoolId: school.id } });
  
  // Count students WITH guardians
  const studentsWithGuardians = await prisma.student.count({
    where: { schoolId: school.id, guardians: { some: {} } }
  });

  // Count guardians with email
  const guardiansWithEmail = await prisma.guardian.count({
    where: { student: { schoolId: school.id }, email: { not: null } }
  });

  // Count guardians with userId (already have login)
  const guardiansLinkedToUser = await prisma.guardian.count({
    where: { student: { schoolId: school.id }, userId: { not: null } }
  });

  // Sample guardians
  const sampleGuardians = await prisma.guardian.findMany({
    where: { student: { schoolId: school.id } },
    include: { student: { include: { user: { select: { firstName: true, lastName: true, email: true } } } } },
    take: 5
  });

  // Existing PARENT role users
  const existingParentUsers = await prisma.user.count({ where: { schoolId: school.id, role: 'PARENT' } });

  console.log('=== PARENT ACCOUNT AUDIT ===');
  console.log(`Total Students: ${totalStudents}`);
  console.log(`Students with guardian records: ${studentsWithGuardians}`);
  console.log(`Guardian records with email: ${guardiansWithEmail}`);
  console.log(`Guardians already linked to User: ${guardiansLinkedToUser}`);
  console.log(`Existing PARENT role accounts: ${existingParentUsers}`);
  console.log('\nSample guardian records:');
  sampleGuardians.forEach(g => {
    console.log(`  - ${g.firstName} ${g.lastName} | ${g.relationship} | email: ${g.email || 'NONE'} | phone: ${g.phone} | userId: ${g.userId || 'NOT LINKED'}`);
    console.log(`    -> Student: ${g.student.user.firstName} ${g.student.user.lastName} (${g.student.user.email})`);
  });
}

audit().catch(console.error).finally(() => prisma.$disconnect());
