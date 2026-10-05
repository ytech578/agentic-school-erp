let PrismaClient;
try {
  PrismaClient = require('@prisma/client').PrismaClient;
} catch {
  PrismaClient = require('../../apps/api/node_modules/@prisma/client').PrismaClient;
}
const prisma = new PrismaClient();

const FULL_CURRICULUM = {
  // Class 1 - 3 (Lower Primary): 8 subjects
  lowerPrimary: [
    'English',
    'Hindi',
    'Telugu',
    'Mathematics',
    'Environmental Science',
    'Computer Science',
    'General Science',
    'Physical Education'
  ],
  // Class 4 - 5 (Upper Primary): 9 subjects
  upperPrimary: [
    'English',
    'Hindi',
    'Telugu',
    'Mathematics',
    'Environmental Science',
    'General Science',
    'Social Studies',
    'Computer Science',
    'Physical Education'
  ],
  // Class 6 - 8 (Middle School): 10 subjects
  middle: [
    'English',
    'Hindi',
    'Telugu',
    'Sanskrit',
    'Mathematics',
    'General Science',
    'Physical Science',
    'Biological Science',
    'Social Studies',
    'Computer Science',
    'Physical Education'
  ],
  // Class 9 - 10 (Secondary): 10 subjects
  secondary: [
    'English',
    'Hindi',
    'Telugu',
    'Mathematics',
    'Physics',
    'Chemistry',
    'Biological Science',
    'Social Studies',
    'History',
    'Economics',
    'Computer Science',
    'Physical Education'
  ]
};

async function main() {
  console.log('📚 Upgrading Class Subjects and Exam Subjects to comprehensive enterprise curriculum...');

  const school = await prisma.school.findFirst({ where: { code: 'DEMO001' } });
  if (!school) throw new Error('School DEMO001 not found');
  const sid = school.id;

  const allSubjects = await prisma.subject.findMany({ where: { schoolId: sid } });
  const subjectMap = new Map(allSubjects.map(s => [s.name, s.id]));

  const classes = await prisma.class.findMany({
    where: { schoolId: sid },
    orderBy: { numericLevel: 'asc' }
  });

  let mappedClassSubjects = 0;

  for (const cls of classes) {
    let subjectNames = [];
    const level = cls.numericLevel;

    // In this school:
    // Class 1 (level 3), Class 2 (level 4), Class 3 (level 5) -> lowerPrimary
    // Class 4 (level 6), Class 5 (level 7) -> upperPrimary
    // Class 6 (level 8), Class 7 (level 9), Class 8 (level 10) -> middle
    // Class 9 (level 11), Class 10 (level 12) -> secondary
    if (cls.name === 'Class 1' || cls.name === 'Class 2' || cls.name === 'Class 3') {
      subjectNames = FULL_CURRICULUM.lowerPrimary;
    } else if (cls.name === 'Class 4' || cls.name === 'Class 5') {
      subjectNames = FULL_CURRICULUM.upperPrimary;
    } else if (cls.name === 'Class 6' || cls.name === 'Class 7' || cls.name === 'Class 8') {
      subjectNames = FULL_CURRICULUM.middle;
    } else {
      subjectNames = FULL_CURRICULUM.secondary;
    }

    for (const subName of subjectNames) {
      const subjectId = subjectMap.get(subName);
      if (!subjectId) continue;

      await prisma.classSubject.upsert({
        where: {
          classId_subjectId: {
            classId: cls.id,
            subjectId: subjectId
          }
        },
        create: {
          classId: cls.id,
          subjectId: subjectId
        },
        update: {}
      });
      mappedClassSubjects++;
    }

    console.log(`  ✅ ${cls.name}: configured ${subjectNames.length} curriculum subjects`);
  }

  // Now ensure all Exams have ExamSubject entries for these class subjects
  const exams = await prisma.exam.findMany({
    where: { schoolId: sid },
    include: { subjects: true }
  });

  let createdExamSubjects = 0;

  for (const ex of exams) {
    console.log(`\nConfiguring Exam Subjects for "${ex.name}"...`);
    const maxMarks = ex.examType === 'UNIT_TEST' ? 25 : 80;
    const passMarks = ex.examType === 'UNIT_TEST' ? 10 : 32;

    for (const cls of classes) {
      const classSubjects = await prisma.classSubject.findMany({
        where: { classId: cls.id }
      });

      for (const cs of classSubjects) {
        const existing = await prisma.examSubject.findFirst({
          where: {
            examId: ex.id,
            subjectId: cs.subjectId,
            classId: cls.id
          }
        });

        if (!existing) {
          await prisma.examSubject.create({
            data: {
              examId: ex.id,
              subjectId: cs.subjectId,
              classId: cls.id,
              maxMarks,
              passMarks,
              duration: maxMarks === 25 ? 60 : 180,
              examDate: ex.startDate
            }
          });
          createdExamSubjects++;
        }
      }
    }
  }

  console.log(`\n🎉 Configured ${mappedClassSubjects} Class Subjects and created ${createdExamSubjects} new Exam Subjects across all exams!`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
