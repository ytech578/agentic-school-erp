const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const es = await prisma.examSubject.findMany({ include: { subject: true, exam: true } });
  console.log(JSON.stringify(es, null, 2));
}
main().catch(console.error).finally(() => prisma.$disconnect());
