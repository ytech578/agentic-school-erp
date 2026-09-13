const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function audit() {
  const school = await prisma.school.findFirst({ where: { code: 'DEMO001' } });
  const sid = school.id;

  const students = await prisma.student.count({ where: { schoolId: sid } });
  const parents = await prisma.user.count({ where: { schoolId: sid, role: 'PARENT' } });
  const guardians = await prisma.guardian.count({ where: { student: { schoolId: sid } } });
  const exams = await prisma.exam.count({ where: { schoolId: sid } });
  const examSubjects = await prisma.examSubject.count({ where: { exam: { schoolId: sid } } });
  const marks = await prisma.studentMark.count();
  const reportCards = await prisma.reportCard.count();
  const attendance = await prisma.attendanceRecord.count({ where: { schoolId: sid } });
  const assignments = await prisma.assignment.count({ where: { schoolId: sid } });
  const submissions = await prisma.assignmentSubmission.count();
  const feeStructures = await prisma.feeStructure.count({ where: { schoolId: sid } });
  const feePayments = await prisma.feePayment.count({ where: { schoolId: sid } });
  const overdueFees = await prisma.feePayment.count({ where: { schoolId: sid, paymentStatus: 'OVERDUE' } });
  const paidFees = await prisma.feePayment.count({ where: { schoolId: sid, paymentStatus: 'PAID' } });
  const pendingFees = await prisma.feePayment.count({ where: { schoolId: sid, paymentStatus: 'PENDING' } });
  const classSubjects = await prisma.classSubject.count({ where: { class: { schoolId: sid } } });
  const teacherAssignments = await prisma.teacherAssignment.count();

  console.log('\n================ FULL SYSTEM AUDIT ================');
  console.log(`School:                  ${school.name} (${school.code})`);
  console.log(`Students:                ${students}`);
  console.log(`Guardians:               ${guardians}`);
  console.log(`Parent User Accounts:    ${parents}`);
  console.log(`Class Subjects Mapped:   ${classSubjects}`);
  console.log(`Teacher Assignments:     ${teacherAssignments}`);
  console.log(`---------------------------------------------------`);
  console.log(`Exams Created:           ${exams}`);
  console.log(`Exam Subjects:           ${examSubjects}`);
  console.log(`Student Marks Seeded:    ${marks}`);
  console.log(`Report Cards Generated:  ${reportCards}`);
  console.log(`---------------------------------------------------`);
  console.log(`Attendance Records:      ${attendance}`);
  console.log(`Assignments Created:     ${assignments}`);
  console.log(`Assignment Submissions:  ${submissions}`);
  console.log(`---------------------------------------------------`);
  console.log(`Fee Structures:          ${feeStructures}`);
  console.log(`Fee Payments Total:      ${feePayments}`);
  console.log(`  - Paid:                ${paidFees}`);
  console.log(`  - Overdue:             ${overdueFees}`);
  console.log(`  - Pending:             ${pendingFees}`);
  console.log('===================================================\n');
}

audit().catch(console.error).finally(() => prisma.$disconnect());
