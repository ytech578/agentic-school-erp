/**
 * Fix-up script — Creates parent accounts for students that were MISSED
 * due to email collisions in the first run. Uses student admissionNumber
 * as a guaranteed unique suffix.
 */

const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

async function main() {
  if (process.env.NODE_ENV === 'production' && process.env.SEED_DEMO_DATA !== 'true') {
    console.log('Skipping demo parent fix in production (SEED_DEMO_DATA is not set to "true").');
    return;
  }

  const demoPassword = process.env.DEMO_PASSWORD;
  if (!demoPassword) {
    throw new Error('DEMO_PASSWORD environment variable is required to run fix_missing_parents.js');
  }

  const passwordHash = await bcrypt.hash(demoPassword, 10);

  console.log('🔍 Finding students still missing parent accounts...\n');

  const school = await prisma.school.findFirst({ where: { code: 'DEMO001' } });
  if (!school) throw new Error('School not found');

  // Find all students with NO guardian userId link
  const students = await prisma.student.findMany({
    where: {
      schoolId: school.id,
      isActive: true,
      guardians: { none: { userId: { not: null } } },
    },
    include: {
      user: { select: { firstName: true, lastName: true, email: true } },
    },
  });

  console.log(`📋 Students still needing parent accounts: ${students.length}`);
  if (students.length === 0) { console.log('✅ All students already have parent accounts!'); return; }

  const credentials = [];
  let created = 0;
  let errors = 0;

  for (const student of students) {
    try {
      const studentFirstName = (student.user.firstName || 'parent').toLowerCase().replace(/[^a-z]/g, '');
      const studentLastName = (student.user.lastName || 'user').toLowerCase().replace(/[^a-z]/g, '');
      // Use admissionNumber as guaranteed unique suffix
      const admSuffix = (student.admissionNumber || student.id.slice(-6)).replace(/[^a-z0-9]/gi, '').toLowerCase();

      const parentEmail = `parent.${studentFirstName}${studentLastName}.${admSuffix}@sunriseschool.edu.in`;

      const parentUser = await prisma.user.create({
        data: {
          schoolId: school.id,
          email: parentEmail,
          passwordHash,
          role: 'PARENT',
          status: 'ACTIVE',
          firstName: student.user.lastName,
          lastName: 'Parent',
          emailVerified: true,
        },
      });

      await prisma.guardian.create({
        data: {
          studentId: student.id,
          userId: parentUser.id,
          relationship: 'Parent',
          firstName: student.user.lastName,
          lastName: 'Parent',
          phone: '0000000000',
          email: parentEmail,
          isPrimary: true,
        },
      });

      credentials.push({
        studentName: `${student.user.firstName} ${student.user.lastName}`,
        studentEmail: student.user.email,
        parentEmail,
      });

      console.log(`  ✅ ${student.user.firstName} ${student.user.lastName} → ${parentEmail}`);
      created++;
    } catch (err) {
      console.error(`  ❌ Error for ${student.user.firstName} ${student.user.lastName}:`, err.message);
      errors++;
    }
  }

  console.log(`\n✅ Fixed! Created: ${created} | Errors: ${errors}`);

  // Append to the existing credentials CSV
  const csvPath = path.join(__dirname, 'parent.credentials.csv');
  const appendRows = credentials.map(c =>
    `"${c.studentName}","${c.studentEmail}","${c.parentEmail}","Parent"`
  ).join('\n');
  
  if (credentials.length > 0) {
    fs.appendFileSync(csvPath, '\n' + appendRows, 'utf-8');
    console.log(`\n📄 Appended ${created} rows to: ${csvPath}`);
    console.log(`   → Passwords are configured through DEMO_PASSWORD.`);
  }
}

main()
  .catch(e => { console.error('Fatal:', e); process.exit(1); })
  .finally(() => prisma.$disconnect());
