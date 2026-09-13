// Debug: check academic year linkage
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function debug() {
  const school = await prisma.school.findFirst({ where: { code: 'DEMO001' } });
  const sid = school.id;
  
  const ays = await prisma.academicYear.findMany({ where: { schoolId: sid } });
  console.log('Academic Years:', ays.map(a => `${a.name} (${a.id}) active=${a.isActive}`));
  
  const classes = await prisma.class.findMany({ where: { schoolId: sid }, select: { id: true, name: true, academicYearId: true }, take: 5 });
  console.log('\nSample Classes:', classes);
  
  const activeAy = ays.find(a => a.isActive);
  const classesInAY = await prisma.class.count({ where: { schoolId: sid, academicYearId: activeAy?.id } });
  const classesAny = await prisma.class.count({ where: { schoolId: sid } });
  console.log(`\nClasses in active AY: ${classesInAY} | Total classes: ${classesAny}`);
  
  // Check enrollments
  const enrollmentsInAY = await prisma.studentEnrollment.count({ where: { academicYearId: activeAy?.id, status: 'ACTIVE' } });
  const enrollmentsAny = await prisma.studentEnrollment.count({ where: { status: 'ACTIVE' } });
  console.log(`Enrollments in active AY: ${enrollmentsInAY} | Total active enrollments: ${enrollmentsAny}`);

  // Sample enrollment 
  const sampleEnrollment = await prisma.studentEnrollment.findFirst({ 
    where: { status: 'ACTIVE' },
    select: { id: true, academicYearId: true, sectionId: true }
  });
  console.log('\nSample Enrollment:', sampleEnrollment);
  
  // Class subjects
  const classSubjects = await prisma.classSubject.count();
  console.log(`ClassSubjects total: ${classSubjects}`);
  const sampleCS = await prisma.classSubject.findFirst({ include: { class: { select: { name: true, academicYearId: true } }, subject: { select: { name: true } } } });
  console.log('Sample ClassSubject:', sampleCS ? `${sampleCS.class.name} - ${sampleCS.subject.name} (ayId: ${sampleCS.class.academicYearId})` : 'NONE');
}
debug().catch(console.error).finally(() => prisma.$disconnect());
