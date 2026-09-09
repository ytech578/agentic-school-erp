const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();

async function main() {
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
      
      const plainPassword = `${cleanFirst}123`;
      const hashedPassword = await bcrypt.hash(plainPassword, 12);
      
      await prisma.user.update({
        where: { id: student.id },
        data: {
          email: newEmail,
          passwordHash: hashedPassword
        }
      });
      console.log(`Updated ${student.email} -> ${newEmail} (Password: ${plainPassword})`);
      updatedCount++;
    }
  }
  console.log(`Done. Updated ${updatedCount} students.`);
}

main().catch(e => { console.error(e); }).finally(() => { prisma.$disconnect(); });
