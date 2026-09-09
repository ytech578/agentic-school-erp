import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function seed() {
  const school = await prisma.school.findFirst();
  if (!school) return console.log('No school found');

  const student = await prisma.student.findFirst({
    include: { user: true },
    where: {
      feePayments: { some: { outstandingAmount: { gt: 0 } } }
    }
  });

  if (!student) return console.log('No student with dues found');

  const hashedPassword = await bcrypt.hash('password123', 10);

  const parentUser = await prisma.user.create({
    data: {
      email: 'parent@school.com',
      passwordHash: hashedPassword,
      firstName: 'Mrs.',
      lastName: 'Rao',
      role: 'PARENT',
      schoolId: school.id,
      status: 'ACTIVE',
    }
  });

  await prisma.guardian.create({
    data: {
      userId: parentUser.id,
      studentId: student.id,
      relationship: 'Mother',
      firstName: 'Mrs.',
      lastName: 'Rao',
      phone: '9876543210',
      email: 'parent@school.com',
    }
  });

  console.log('Created parent account: parent@school.com / password123 linked to student: ' + student.user.firstName);
}

seed().catch(console.error).finally(() => prisma.$disconnect());
