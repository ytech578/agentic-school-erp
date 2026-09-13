const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function probe() {
  const school = await prisma.school.findFirst({ where: { code: 'DEMO001' } });
  const subjects = await prisma.subject.findMany({ where: { schoolId: school.id } });
  console.log('Total subjects in school:', subjects.length, subjects.map(s => s.name));
  
  const classSubjects = await prisma.classSubject.findMany({ 
    where: { class: { schoolId: school.id } },
    include: { class: true, subject: true } 
  });
  console.log('Total ClassSubject mappings:', classSubjects.length);

  const classes = await prisma.class.findMany({ where: { schoolId: school.id } });
  console.log('Classes:', classes.map(c => ({ id: c.id, name: c.name, academicYearId: c.academicYearId })));
}

probe().catch(console.error).finally(() => prisma.$disconnect());
