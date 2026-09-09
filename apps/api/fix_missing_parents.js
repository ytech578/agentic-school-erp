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
      const plainPassword = `${studentFirstName}@parent123`;
      const passwordHash = await bcrypt.hash(plainPassword, 10);

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
        password: plainPassword,
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
  const csvPath = path.join(__dirname, 'parent_credentials.csv');
  const appendRows = credentials.map(c =>
    `"${c.studentName}","${c.studentEmail}","${c.parentEmail}","${c.password}","Parent"`
  ).join('\n');
  
  if (credentials.length > 0) {
    fs.appendFileSync(csvPath, '\n' + appendRows, 'utf-8');
    console.log(`\n📄 Appended ${created} rows to: ${csvPath}`);
  }
}

main()
  .catch(e => { console.error('Fatal:', e); process.exit(1); })
  .finally(() => prisma.$disconnect());
