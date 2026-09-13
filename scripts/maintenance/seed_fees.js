/**
 * SEED SCRIPT 1D — Fee Payments
 * - 400 students: PAID (full payment, various past dates, receipts generated)
 * - 100 students: OVERDUE (past due date, unpaid or partial)
 * - Remaining ~205: PENDING
 * 
 * Uses actual FeeStructure items for realistic amounts.
 */
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

function randInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function daysAgo(n) { return new Date(Date.now() - n * 86400000); }

const PAYMENT_MODES = ['CASH', 'ONLINE_UPI', 'NEFT', 'CHEQUE'];

async function main() {
  console.log('💰 Starting Fee Payments Seeding...\n');

  const school = await prisma.school.findFirst({ where: { code: 'DEMO001' } });
  const sid = school.id;
  const ay = await prisma.academicYear.findFirst({ where: { schoolId: sid, isActive: true } });

  // Get admin to use as collectedById
  const adminUser = await prisma.user.findFirst({ where: { schoolId: sid, role: 'SCHOOL_ADMIN' } });

  // Get fee structures and their items
  const feeStructures = await prisma.feeStructure.findMany({
    where: { schoolId: sid },
    include: { items: { include: { feeHead: true } } }
  });

  if (!feeStructures.length) {
    console.log('❌ No fee structures found! Please create fee structures first.');
    return;
  }

  // Get all active students
  const students = await prisma.student.findMany({
    where: { schoolId: sid, isActive: true },
    select: { id: true, admissionNumber: true }
  });

  console.log(`Students: ${students.length} | Fee Structures: ${feeStructures.length}\n`);

  // Shuffle students for deterministic partition
  const shuffled = [...students].sort(() => Math.random() - 0.5);
  const paidStudents = shuffled.slice(0, 400);
  const overdueStudents = shuffled.slice(400, 500);
  const pendingStudents = shuffled.slice(500);

  // Use the first fee structure for amounts
  const feeStructure = feeStructures[0];
  const totalAmount = feeStructure.items.reduce((sum, i) => sum + Number(i.amount), 0) || 45000;

  let paymentsMade = 0;
  let receiptSeq = 1000;

  // ── PAID Students (400) ───────────────────────────────────────────
  console.log(`Creating ${paidStudents.length} PAID records...`);
  for (const student of paidStudents) {
    const existingPayment = await prisma.feePayment.findFirst({
      where: { studentId: student.id, academicYearId: ay.id }
    });
    if (existingPayment) continue;

    const paymentDate = daysAgo(randInt(5, 75));
    const mode = PAYMENT_MODES[randInt(0, PAYMENT_MODES.length - 1)];
    receiptSeq++;

    const payment = await prisma.feePayment.create({
      data: {
        schoolId: sid,
        studentId: student.id,
        academicYearId: ay.id,
        totalAmount,
        paidAmount: totalAmount,
        discountAmount: 0,
        fineAmount: 0,
        outstandingAmount: 0,
        paymentMode: mode,
        paymentStatus: 'PAID',
        transactionRef: mode !== 'CASH' ? `TXN${Date.now().toString().slice(-6)}${receiptSeq}` : null,
        collectedById: adminUser.id,
        paymentDate,
        items: {
          create: feeStructure.items.map(item => ({
            feeHeadId: item.feeHeadId,
            amount: item.amount,
            period: 'Term 1 & 2',
          }))
        }
      }
    });

    // Create receipt
    await prisma.receipt.create({
      data: {
        feePaymentId: payment.id,
        receiptNumber: `RCP-2026-${receiptSeq}`,
        issuedAt: paymentDate,
      }
    }).catch(err => console.warn('Receipt create error:', err.message));

    paymentsMade++;
    if (paymentsMade % 100 === 0) process.stdout.write(`  ... ${paymentsMade} paid records created\n`);
  }

  // ── OVERDUE Students (100) ─────────────────────────────────────────
  console.log(`\nCreating ${overdueStudents.length} OVERDUE records...`);
  let overdueCount = 0;
  for (const student of overdueStudents) {
    const existingPayment = await prisma.feePayment.findFirst({
      where: { studentId: student.id, academicYearId: ay.id }
    });
    if (existingPayment) continue;

    // Some have made partial payment, some have paid 0
    const partialPaid = Math.random() < 0.35 ? randInt(Math.floor(totalAmount * 0.2), Math.floor(totalAmount * 0.4)) : 0;
    const fine = 1200; // Late payment fine
    const outstanding = totalAmount - partialPaid + fine;

    await prisma.feePayment.create({
      data: {
        schoolId: sid,
        studentId: student.id,
        academicYearId: ay.id,
        totalAmount: totalAmount + fine,
        paidAmount: partialPaid,
        discountAmount: 0,
        fineAmount: fine,
        outstandingAmount: outstanding,
        paymentMode: partialPaid > 0 ? 'CASH' : 'ONLINE_UPI',
        paymentStatus: 'OVERDUE',
        remarks: 'Fee payment overdue. Notice sent to guardian. Late fee applied.',
        collectedById: adminUser.id,
        paymentDate: daysAgo(randInt(30, 60)),
        items: {
          create: feeStructure.items.map(item => ({
            feeHeadId: item.feeHeadId,
            amount: item.amount,
            period: 'Term 1 & 2',
          }))
        }
      }
    });
    overdueCount++;
  }

  // ── PENDING Students (~205) ────────────────────────────────────────
  console.log(`\nCreating ${pendingStudents.length} PENDING records...`);
  let pendingCount = 0;
  for (const student of pendingStudents) {
    const existingPayment = await prisma.feePayment.findFirst({
      where: { studentId: student.id, academicYearId: ay.id }
    });
    if (existingPayment) continue;

    await prisma.feePayment.create({
      data: {
        schoolId: sid,
        studentId: student.id,
        academicYearId: ay.id,
        totalAmount,
        paidAmount: 0,
        discountAmount: 0,
        fineAmount: 0,
        outstandingAmount: totalAmount,
        paymentMode: 'ONLINE_UPI',
        paymentStatus: 'PENDING',
        remarks: 'Term fee invoice issued. Awaiting payment.',
        collectedById: adminUser.id,
        paymentDate: new Date(),
        items: {
          create: feeStructure.items.map(item => ({
            feeHeadId: item.feeHeadId,
            amount: item.amount,
            period: 'Term 1 & 2',
          }))
        }
      }
    });
    pendingCount++;
  }

  const [paidTotal, overdueTotal, pendingTotal] = await Promise.all([
    prisma.feePayment.count({ where: { schoolId: sid, paymentStatus: 'PAID' } }),
    prisma.feePayment.count({ where: { schoolId: sid, paymentStatus: 'OVERDUE' } }),
    prisma.feePayment.count({ where: { schoolId: sid, paymentStatus: 'PENDING' } }),
  ]);

  console.log(`\n🎉 DONE!`);
  console.log(`   PAID:    ${paidTotal} students`);
  console.log(`   OVERDUE: ${overdueTotal} students`);
  console.log(`   PENDING: ${pendingTotal} students`);
  console.log(`   Total active fee records: ${paidTotal + overdueTotal + pendingTotal}`);
}

main().catch(e => {
  console.error('❌ Error:', e);
  process.exit(1);
}).finally(() => prisma.$disconnect());
