/**
 * Setup Class Subjects
 * Maps standard school curriculum subjects to each Class (1 to 12).
 */
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const CURRICULUM = {
  // Class 1 - 5: Primary
  primary: ['English', 'Hindi', 'Telugu', 'Mathematics', 'Environmental Science', 'Computer Science'],
  // Class 6 - 8: Middle school
  middle: ['English', 'Hindi', 'Telugu', 'Mathematics', 'General Science', 'Social Studies', 'Computer Science'],
  // Class 9 - 10: High school
  high: ['English', 'Hindi', 'Telugu', 'Mathematics', 'Physical Science', 'Biological Science', 'Social Studies', 'Computer Science'],
  // Class 11 - 12: Higher secondary
  senior: ['English', 'Physics', 'Chemistry', 'Mathematics', 'Computer Science', 'Economics'],
};

async function main() {
  console.log('📚 Setting up Class Subjects curriculum mappings...\n');

  const school = await prisma.school.findFirst({ where: { code: 'DEMO001' } });
  const sid = school.id;

  const allSubjects = await prisma.subject.findMany({ where: { schoolId: sid } });
  const subjectMap = new Map(allSubjects.map(s => [s.name, s.id]));

  const classes = await prisma.class.findMany({
    where: { schoolId: sid },
    orderBy: { numericLevel: 'asc' }
  });

  let createdCount = 0;

  for (const cls of classes) {
    let subjectNames = [];
    const level = cls.numericLevel;

    if (level <= 5) {
      subjectNames = CURRICULUM.primary;
    } else if (level <= 8) {
      subjectNames = CURRICULUM.middle;
    } else if (level <= 10) {
      subjectNames = CURRICULUM.high;
    } else {
      subjectNames = CURRICULUM.senior;
    }

    for (const subName of subjectNames) {
      const subjectId = subjectMap.get(subName);
      if (!subjectId) {
        console.warn(`Subject not found: ${subName}`);
        continue;
      }

      await prisma.classSubject.upsert({
        where: {
          classId_subjectId: {
            classId: cls.id,
            subjectId: subjectId,
          }
        },
        create: {
          classId: cls.id,
          subjectId: subjectId,
        },
        update: {}
      });
      createdCount++;
    }

    console.log(`  ✅ ${cls.name} (Level ${level}): mapped ${subjectNames.length} subjects`);
  }

  // Also verify/create teacher assignments if needed
  const staff = await prisma.staff.findMany({
    where: { schoolId: sid, isActive: true },
    include: { teacherAssignments: true }
  });
  console.log(`\n👨‍🏫 Found ${staff.length} active staff members.`);

  // If staff has no teacher assignments, link them to sections & subjects
  const ay = await prisma.academicYear.findFirst({ where: { schoolId: sid, isActive: true } });
  const sections = await prisma.section.findMany({
    where: { class: { schoolId: sid, academicYearId: ay.id } },
    include: { class: { include: { subjects: true } } }
  });

  let taCount = 0;
  if (staff.length > 0) {
    let staffIdx = 0;
    for (const sec of sections) {
      // Assign a class teacher
      const classTeacher = staff[staffIdx % staff.length];
      await prisma.teacherAssignment.upsert({
        where: {
          staffId_sectionId_subjectId: {
            staffId: classTeacher.id,
            sectionId: sec.id,
            subjectId: sec.class.subjects[0]?.subjectId || null
          }
        },
        create: {
          staffId: classTeacher.id,
          sectionId: sec.id,
          subjectId: sec.class.subjects[0]?.subjectId || null,
          isClassTeacher: true,
          academicYearId: ay.id
        },
        update: { isClassTeacher: true }
      });
      taCount++;

      // Assign teachers to subjects
      for (const cs of sec.class.subjects) {
        staffIdx++;
        const teacher = staff[staffIdx % staff.length];
        await prisma.teacherAssignment.upsert({
          where: {
            staffId_sectionId_subjectId: {
              staffId: teacher.id,
              sectionId: sec.id,
              subjectId: cs.subjectId
            }
          },
          create: {
            staffId: teacher.id,
            sectionId: sec.id,
            subjectId: cs.subjectId,
            isClassTeacher: false,
            academicYearId: ay.id
          },
          update: {}
        });
        taCount++;
      }
    }
    console.log(`  ✅ Teacher assignments established: ${taCount}`);
  }

  console.log(`\n🎉 Class subjects setup complete! Total ClassSubject records: ${createdCount}`);
}

main().catch(err => {
  console.error('❌ Error:', err);
  process.exit(1);
}).finally(() => prisma.$disconnect());
