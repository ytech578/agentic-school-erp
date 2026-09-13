const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();

async function main() {
  if (process.env.NODE_ENV === 'production' && process.env.SEED_DEMO_DATA !== 'true') {
    console.log('Skipping email fix in production (SEED_DEMO_DATA is not set to "true").');
    return;
  }

  const demoPassword = process.env.DEMO_PASSWORD;
  if (!demoPassword) {
    throw new Error('DEMO_PASSWORD environment variable is required to run fix_emails.js');
  }

  const hashedPassword = await bcrypt.hash(demoPassword, 12);

  const students = await prisma.user.findMany({
    where: { role: 'STUDENT' },
  });
  
  let updatedCount = 0;
  for (const student of students) {
    if (student.email.includes('demo.edu.in')) {
      const cleanFirst = student.firstName.toLowerCase().replace(/[^a-z]/g, '');
      const cleanLast = student.lastName.toLowerCase().replace(/[^a-z]/g, '');
      let newEmail = `${cleanFirst}.${cleanLast}@student.sunriseschool.edu.in`;
      
      // Ensure unique
      let counter = 1;
      while (true) {
        const existing = await prisma.user.findUnique({ where: { email: newEmail } });
        if (!existing || existing.id === student.id) {
          break;
        }
        newEmail = `${cleanFirst}.${cleanLast}${counter}@student.sunriseschool.edu.in`;
        counter++;
      }
      

      
      await prisma.user.update({
        where: { id: student.id },
        data: {
          email: newEmail,
          passwordHash: hashedPassword
        }
      });
      console.log(`Updated ${student.email} -> ${newEmail} (Password: supplied through DEMO_PASSWORD)`);
      updatedCount++;
    }
  }
  console.log(`Done. Updated ${updatedCount} students.`);
}

main().catch(e => { console.error(e); }).finally(() => { prisma.$disconnect(); });
