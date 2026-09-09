/**
 * Bulk Parent Account Creator — Option A (Testing Mode)
 * 
 * For every student WITHOUT a primary guardian user account:
 * 1. Creates a Guardian record (derived from student's surname)
 * 2. Creates a User with role PARENT
 * 3. Links Guardian.userId → User.id
 * 4. Exports credentials CSV for distribution
 */

const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

// Pre-computed bcrypt hash for faster batch processing
// We hash per-password since each is unique (firstname@parent123)
const BATCH_SIZE = 20; // Process in batches to avoid DB overload

async function main() {
  console.log('🔍 Finding school...');
  const school = await prisma.school.findFirst({ where: { code: 'DEMO001' } });
  if (!school) throw new Error('Demo school not found.');

  console.log(`✅ School: ${school.name} (${school.id})\n`);

  // Fetch all students without a linked parent user account
  const students = await prisma.student.findMany({
    where: {
      schoolId: school.id,
      isActive: true,
    },
    include: {
      user: { select: { firstName: true, lastName: true, email: true } },
      guardians: { where: { userId: { not: null } } }, // already linked guardians
    },
  });

  // Filter: only students with NO linked guardian user
  const studentsWithoutParent = students.filter(s => s.guardians.length === 0);
  console.log(`📊 Total students: ${students.length}`);
  console.log(`👨‍👩‍👧 Students already with parent login: ${students.length - studentsWithoutParent.length}`);
  console.log(`🚀 Students needing parent accounts: ${studentsWithoutParent.length}\n`);

  const credentials = [];
  let created = 0;
  let skipped = 0;
  let errors = 0;

  // Process in batches
  for (let i = 0; i < studentsWithoutParent.length; i += BATCH_SIZE) {
    const batch = studentsWithoutParent.slice(i, i + BATCH_SIZE);
    console.log(`Processing batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(studentsWithoutParent.length / BATCH_SIZE)}...`);

    for (const student of batch) {
      try {
        const studentFirstName = (student.user.firstName || 'Parent').toLowerCase().replace(/[^a-z]/g, '');
        const studentLastName = (student.user.lastName || 'User').toLowerCase().replace(/[^a-z]/g, '');

        // Generate parent credentials
        const parentEmail = `parent.${studentFirstName}${studentLastName}@sunriseschool.edu.in`;
        const plainPassword = `${studentFirstName}@parent123`;

        // Check if this email already exists (handle duplicates by appending student id suffix)
        const existingUser = await prisma.user.findUnique({ where: { email: parentEmail } });
        const finalEmail = existingUser
          ? `parent.${studentFirstName}${studentLastName}.${student.id.slice(-4)}@sunriseschool.edu.in`
          : parentEmail;

        // Hash password
        const passwordHash = await bcrypt.hash(plainPassword, 10); // cost 10 for speed in testing

        // Create parent User account
        const parentUser = await prisma.user.create({
          data: {
            schoolId: school.id,
            email: finalEmail,
            passwordHash,
            role: 'PARENT',
            status: 'ACTIVE',
            firstName: student.user.lastName, // e.g. "Sharma" family
            lastName: 'Parent',
            emailVerified: true,
          },
        });

        // Create Guardian record and link to User
        await prisma.guardian.create({
          data: {
            studentId: student.id,
            userId: parentUser.id,
            relationship: 'Parent',
            firstName: student.user.lastName,
            lastName: 'Parent',
            phone: '0000000000', // placeholder — can be updated via profile
            email: finalEmail,
            isPrimary: true,
          },
        });

        credentials.push({
          studentName: `${student.user.firstName} ${student.user.lastName}`,
          studentEmail: student.user.email,
          parentEmail: finalEmail,
          password: plainPassword,
          relationship: 'Parent',
        });

        created++;
      } catch (err) {
        console.error(`  ⚠️  Error for student ${student.user.firstName} ${student.user.lastName}:`, err.message);
        errors++;
      }
    }
  }

  console.log('\n✅ Done!');
  console.log(`   Created: ${created} parent accounts`);
  console.log(`   Skipped: ${skipped}`);
  console.log(`   Errors:  ${errors}`);

  // Export credentials CSV
  const csvPath = path.join(__dirname, 'parent_credentials.csv');
  const csvHeader = 'Student Name,Student Email,Parent Login Email,Parent Password,Relationship\n';
  const csvRows = credentials.map(c =>
    `"${c.studentName}","${c.studentEmail}","${c.parentEmail}","${c.password}","${c.relationship}"`
  ).join('\n');
  fs.writeFileSync(csvPath, csvHeader + csvRows, 'utf-8');

  console.log(`\n📄 Credentials CSV exported to: ${csvPath}`);
  console.log(`   → Share this file with parents/admin for login details.\n`);

  // Print sample
  console.log('Sample credentials (first 5):');
  credentials.slice(0, 5).forEach(c => {
    console.log(`  Student: ${c.studentName}`);
    console.log(`  Parent Login: ${c.parentEmail}  |  Password: ${c.password}`);
    console.log('  ---');
  });
}

main()
  .catch(e => { console.error('Fatal error:', e); process.exit(1); })
  .finally(() => prisma.$disconnect());
