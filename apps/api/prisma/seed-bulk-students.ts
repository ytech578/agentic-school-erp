import { PrismaClient, UserRole, UserStatus, BloodGroup, Gender, EnrollmentStatus } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const firstNames = ['Aarav', 'Vihaan', 'Aditya', 'Sai', 'Arjun', 'Siddharth', 'Rohan', 'Dhruv', 'Kabir', 'Vivaan', 'Ananya', 'Diya', 'Suhana', 'Priya', 'Kavya', 'Riya', 'Neha', 'Aisha', 'Tanvi', 'Sara'];
const lastNames = ['Sharma', 'Patel', 'Kumar', 'Singh', 'Gupta', 'Verma', 'Reddy', 'Rao', 'Nair', 'Pillai', 'Joshi', 'Mehta', 'Chauhan', 'Shah', 'Yadav'];

function getRandomElement(arr: any[]) {
  return arr[Math.floor(Math.random() * arr.length)];
}

async function main() {
  console.log('🌱 Bulk seeding 25 students per class...');

  // ─── Environment Guard & Demo Password ─────────────────────────────────
  const isProduction = process.env.NODE_ENV === 'production';
  const shouldSeedDemoData = process.env.SEED_DEMO_DATA === 'true';

  if (isProduction && !shouldSeedDemoData) {
    console.log('⚠️  Production environment detected and SEED_DEMO_DATA is not set to "true".');
    console.log('   Skipping bulk student demo seeding.');
    return;
  }

  const demoPassword = process.env.DEMO_PASSWORD;
  if (!demoPassword) {
    throw new Error(
      'DEMO_PASSWORD environment variable is required to seed bulk students. ' +
      'Please provide DEMO_PASSWORD in your environment or .env file.'
    );
  }

  // Precompute hash once for all generated students
  const passwordHash = await bcrypt.hash(demoPassword, 10);

  const school = await prisma.school.findFirst({ where: { code: 'DEMO001' } });
  if (!school) throw new Error('Demo school not found. Run standard seed first.');

  const academicYear = await prisma.academicYear.findFirst({ where: { schoolId: school.id, isActive: true } });
  if (!academicYear) throw new Error('Active academic year not found.');

  const sections = await prisma.section.findMany({
    where: { class: { schoolId: school.id, academicYearId: academicYear.id } },
    include: { class: true }
  });

  console.log(`Found ${sections.length} sections. Generating ~${sections.length * 25} students...`);

  let globalStudentCounter = 1000;

  for (const section of sections) {
    const studentsToCreate = 25; // Create 25 students per section
    console.log(`Processing ${section.class.name} - ${section.name}...`);
    
    // Batch inserts for performance
    const newUsers = [];
    const newStudents = [];
    const newEnrollments = [];

    for (let i = 0; i < studentsToCreate; i++) {
      globalStudentCounter++;
      const fName = getRandomElement(firstNames);
      const lName = getRandomElement(lastNames);
      const rollNo = String(i + 1).padStart(2, '0');
      
      const cleanFirst = fName.toLowerCase().replace(/[^a-z]/g, '');
      const cleanLast = lName.toLowerCase().replace(/[^a-z]/g, '');
      const email = `${cleanFirst}.${cleanLast}${globalStudentCounter}@student.sunriseschool.edu.in`;
      const admNo = `ADM26${String(globalStudentCounter).padStart(4, '0')}`;
      
      const userId = `USR_${globalStudentCounter}_${Date.now()}`;
      const studentId = `STU_${globalStudentCounter}_${Date.now()}`;
      
      newUsers.push({
        id: userId,
        schoolId: school.id,
        email: email,
        passwordHash,
        role: UserRole.STUDENT,
        status: UserStatus.ACTIVE,
        firstName: fName,
        lastName: lName,
        emailVerified: true,
      });
      
      newStudents.push({
        id: studentId,
        schoolId: school.id,
        userId: userId,
        admissionNumber: admNo,
        dateOfBirth: new Date(2010 - (section.class.numericLevel || 5), Math.floor(Math.random() * 12), Math.floor(Math.random() * 28) + 1),
        gender: Math.random() > 0.5 ? Gender.MALE : Gender.FEMALE,
        bloodGroup: BloodGroup.O_POSITIVE,
        nationality: 'Indian',
        admissionDate: new Date('2026-06-01'),
      });
      
      newEnrollments.push({
        studentId: studentId,
        sectionId: section.id,
        rollNumber: rollNo,
        status: EnrollmentStatus.ACTIVE,
      });
    }

    // Insert batches for this section
    await prisma.user.createMany({ data: newUsers, skipDuplicates: true });
    await prisma.student.createMany({ data: newStudents, skipDuplicates: true });
    await prisma.studentEnrollment.createMany({ data: newEnrollments, skipDuplicates: true });
  }

  console.log('✅ Bulk seeding complete!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
