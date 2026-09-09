import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding teacher assignments...');
  
  // Get the first school
  const school = await prisma.school.findFirst();
  if (!school) return console.log('No school found');
  
  // Get active academic year
  const ay = await prisma.academicYear.findFirst({ where: { schoolId: school.id, isActive: true } });
  if (!ay) return console.log('No active academic year found');

  // Get all teachers
  const teachers = await prisma.staff.findMany({ 
    where: { schoolId: school.id },
    include: { user: true }
  });
  if (teachers.length === 0) return console.log('No teachers found');
  
  // Filter out non-teacher staff if possible, but for MVP any staff will do.
  
  // Get all sections
  const sections = await prisma.section.findMany({ 
    where: { class: { schoolId: school.id } },
    include: { class: true }
  });
  
  // Clear existing assignments so we can re-distribute across new teachers
  await prisma.teacherAssignment.deleteMany();
  
  // Get all subjects
  const subjects = await prisma.subject.findMany({ where: { schoolId: school.id } });
  
  let count = 0;
  let globalTeacherIndex = 0;
  
  function getSubjectsForSection(className: string, sectionName: string): string[] {
    const levelMatch = className.match(/\d+/);
    const level = levelMatch ? parseInt(levelMatch[0]) : 1;
    
    if (level >= 1 && level <= 5) {
      return ['Telugu', 'English', 'Mathematics', 'Environmental Science', 'Physical Education', 'Library', 'Value Education'];
    } else if (level === 6 || level === 7) {
      return ['Telugu', 'Hindi', 'English', 'Mathematics', 'General Science', 'Social Studies', 'Physical Education', 'Computer Science'];
    } else if (level >= 8 && level <= 10) {
      return ['Telugu', 'Hindi', 'English', 'Mathematics', 'Physical Science', 'Biological Science', 'Social Studies', 'Physical Education', 'Computer Science'];
    } else if (level === 11 || level === 12) {
      if (sectionName === 'MPC') return ['Mathematics', 'Physics', 'Chemistry', 'English', 'Sanskrit'];
      if (sectionName === 'BiPC') return ['Botany', 'Zoology', 'Physics', 'Chemistry', 'English', 'Sanskrit'];
      if (sectionName === 'CEC') return ['Civics', 'Economics', 'Commerce', 'English', 'Sanskrit'];
      if (sectionName === 'HEC') return ['History', 'Economics', 'Civics', 'English', 'Sanskrit'];
    }
    return ['English', 'Mathematics']; // fallback
  }
  
  for (const section of sections) {
    const targetSubjectNames = getSubjectsForSection(section.class.name, section.name);
    const targetSubjects = subjects.filter(s => targetSubjectNames.includes(s.name));
    
    for (const subject of targetSubjects) {
      const teacher = teachers[globalTeacherIndex % teachers.length];
      globalTeacherIndex++;
      
      await prisma.teacherAssignment.create({
        data: {
          staffId: teacher.id,
          sectionId: section.id,
          subjectId: subject.id,
          academicYearId: ay.id,
        }
      });
      count++;
    }
  }
  
  console.log(`Successfully seeded ${count} teacher assignments.`);
}

main()
  .catch(e => console.error(e))
  .finally(async () => {
    await prisma.$disconnect();
  });
