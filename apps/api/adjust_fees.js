const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function adjust() {
  const school = await prisma.school.findFirst({ where: { code: 'DEMO001' } });
  const sid = school.id;

  const current = await prisma.feePayment.groupBy({
    by: ['paymentStatus'],
    where: { schoolId: sid },
    _count: true,
  });
  console.log('Current fee breakdown:', current);

  // Take 100 PENDING records and set them to OVERDUE with late fine
  const pendingRecords = await prisma.feePayment.findMany({
    where: { schoolId: sid, paymentStatus: 'PENDING' },
    take: 100
  });

  console.log(`Setting ${pendingRecords.length} records to OVERDUE...`);

  for (const rec of pendingRecords) {
    const fine = 1500;
    const newTotal = Number(rec.totalAmount) + fine;
    await prisma.feePayment.update({
      where: { id: rec.id },
      data: {
        paymentStatus: 'OVERDUE',
        fineAmount: fine,
        totalAmount: newTotal,
        outstandingAmount: newTotal,
        remarks: 'Tuition and term fee overdue. 2nd reminder issued.',
        paymentDate: new Date(Date.now() - 35 * 86400000)
      }
    });
  }

  const finalCounts = await prisma.feePayment.groupBy({
    by: ['paymentStatus'],
    where: { schoolId: sid },
    _count: true,
  });
  console.log('\nFinal fee breakdown after adjustment:', finalCounts);
}

adjust().catch(console.error).finally(() => prisma.$disconnect());
