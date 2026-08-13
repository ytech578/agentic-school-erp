const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
  const students = await prisma.student.findMany();
  console.log("Found students:", students.length);
  if (students.length > 0) {
    console.log(students[0]);
  }
}
check().finally(() => prisma.$disconnect());
