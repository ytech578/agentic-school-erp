import { PrismaClient, UserRole, UserStatus, BloodGroup, EmploymentType } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding AI School ERP database...');

  // ─── Create Demo School ──────────────────────────────────────────────────
  const school = await prisma.school.upsert({
    where: { code: 'DEMO001' },
    update: {},
    create: {
      name: 'Sunrise Public School',
      code: 'DEMO001',
      address: '123, Education Street, Knowledge Nagar',
      city: 'Pune',
      state: 'Maharashtra',
      pinCode: '411001',
      country: 'India',
      phone: '+91-20-12345678',
      email: 'info@sunriseschool.edu.in',
      website: 'https://sunriseschool.edu.in',
      principalName: 'Dr. Rajesh Sharma',
      affiliationNo: 'CBSE/2025/12345',
      boardType: 'CBSE',
      currency: 'INR',
      timezone: 'Asia/Kolkata',
      dateFormat: 'DD/MM/YYYY',
      academicYearStart: '04',
      isActive: true,
    },
  });
  console.log(`✅ School created: ${school.name} (${school.code})`);

  // ─── Create Academic Year ────────────────────────────────────────────────
  const academicYear = await prisma.academicYear.upsert({
    where: { schoolId_name: { schoolId: school.id, name: '2026-27' } },
    update: { isActive: true },
    create: {
      schoolId: school.id,
      name: '2026-27',
      startDate: new Date('2026-04-01'),
      endDate: new Date('2027-03-31'),
      isActive: true,
      isLocked: false,
    },
  });
  console.log(`✅ Academic Year: ${academicYear.name}`);

  const passwordHash = await bcrypt.hash('Admin@1234', 12);

  // ─── Super Admin ─────────────────────────────────────────────────────────
  const superAdmin = await prisma.user.upsert({
    where: { email: 'superadmin@schoolerp.com' },
    update: {},
    create: {
      email: 'superadmin@schoolerp.com',
      passwordHash,
      role: UserRole.SUPER_ADMIN,
      status: UserStatus.ACTIVE,
      firstName: 'Super',
      lastName: 'Admin',
      emailVerified: true,
    },
  });
  console.log(`✅ Super Admin: ${superAdmin.email}`);

  // ─── School Admin ─────────────────────────────────────────────────────────
  const schoolAdmin = await prisma.user.upsert({
    where: { email: 'admin@sunriseschool.edu.in' },
    update: {},
    create: {
      schoolId: school.id,
      email: 'admin@sunriseschool.edu.in',
      passwordHash,
      role: UserRole.SCHOOL_ADMIN,
      status: UserStatus.ACTIVE,
      firstName: 'Admin',
      lastName: 'User',
      phone: '+91-9876543210',
      emailVerified: true,
    },
  });
  console.log(`✅ School Admin: ${schoolAdmin.email}`);

  // ─── Principal ────────────────────────────────────────────────────────────
  const principal = await prisma.user.upsert({
    where: { email: 'principal@sunriseschool.edu.in' },
    update: {},
    create: {
      schoolId: school.id,
      email: 'principal@sunriseschool.edu.in',
      passwordHash,
      role: UserRole.PRINCIPAL,
      status: UserStatus.ACTIVE,
      firstName: 'Rajesh',
      lastName: 'Sharma',
      phone: '+91-9876543211',
      emailVerified: true,
    },
  });
  console.log(`✅ Principal: ${principal.email}`);

  // ─── Departments ─────────────────────────────────────────────────────────
  const departments = await Promise.all([
    prisma.department.upsert({
      where: { schoolId_name: { schoolId: school.id, name: 'Science' } },
      update: {},
      create: { schoolId: school.id, name: 'Science', code: 'SCI' },
    }),
    prisma.department.upsert({
      where: { schoolId_name: { schoolId: school.id, name: 'Mathematics' } },
      update: {},
      create: { schoolId: school.id, name: 'Mathematics', code: 'MATH' },
    }),
    prisma.department.upsert({
      where: { schoolId_name: { schoolId: school.id, name: 'Humanities' } },
      update: {},
      create: { schoolId: school.id, name: 'Humanities', code: 'HUM' },
    }),
    prisma.department.upsert({
      where: { schoolId_name: { schoolId: school.id, name: 'Languages' } },
      update: {},
      create: { schoolId: school.id, name: 'Languages', code: 'LANG' },
    }),
    prisma.department.upsert({
      where: { schoolId_name: { schoolId: school.id, name: 'Physical Education' } },
      update: {},
      create: { schoolId: school.id, name: 'Physical Education', code: 'PE' },
    }),
  ]);
  console.log(`✅ Departments: ${departments.map(d => d.name).join(', ')}`);

  // ─── Designations ─────────────────────────────────────────────────────────
  const designations = await Promise.all([
    prisma.designation.upsert({
      where: { schoolId_name: { schoolId: school.id, name: 'Class Teacher' } },
      update: {},
      create: { schoolId: school.id, name: 'Class Teacher' },
    }),
    prisma.designation.upsert({
      where: { schoolId_name: { schoolId: school.id, name: 'Subject Teacher' } },
      update: {},
      create: { schoolId: school.id, name: 'Subject Teacher' },
    }),
    prisma.designation.upsert({
      where: { schoolId_name: { schoolId: school.id, name: 'Senior Teacher' } },
      update: {},
      create: { schoolId: school.id, name: 'Senior Teacher' },
    }),
    prisma.designation.upsert({
      where: { schoolId_name: { schoolId: school.id, name: 'HOD' } },
      update: {},
      create: { schoolId: school.id, name: 'HOD' },
    }),
  ]);

  // ─── Teachers ─────────────────────────────────────────────────────────────
  const teacherData = [
    { firstName: 'Priya', lastName: 'Patel', email: 'priya.patel@sunriseschool.edu.in', emp: 'EMP001' },
    { firstName: 'Suresh', lastName: 'Kumar', email: 'suresh.kumar@sunriseschool.edu.in', emp: 'EMP002' },
    { firstName: 'Anita', lastName: 'Singh', email: 'anita.singh@sunriseschool.edu.in', emp: 'EMP003' },
    { firstName: 'Deepak', lastName: 'Verma', email: 'deepak.verma@sunriseschool.edu.in', emp: 'EMP004' },
  ];

  const teachers = [];
  for (const t of teacherData) {
    const user = await prisma.user.upsert({
      where: { email: t.email },
      update: {},
      create: {
        schoolId: school.id,
        email: t.email,
        passwordHash,
        role: UserRole.TEACHER,
        status: UserStatus.ACTIVE,
        firstName: t.firstName,
        lastName: t.lastName,
        emailVerified: true,
      },
    });

    const staff = await prisma.staff.upsert({
      where: { schoolId_employeeId: { schoolId: school.id, employeeId: t.emp } },
      update: {},
      create: {
        schoolId: school.id,
        userId: user.id,
        employeeId: t.emp,
        departmentId: departments[0].id,
        designationId: designations[1].id,
        employmentType: EmploymentType.FULL_TIME,
        joinDate: new Date('2022-06-01'),
      },
    });

    teachers.push({ user, staff });
  }
  console.log(`✅ Teachers: ${teacherData.map(t => t.firstName).join(', ')}`);

  // ─── Subjects ─────────────────────────────────────────────────────────────
  const subjectNames = ['Mathematics', 'Science', 'English', 'Hindi', 'Social Studies', 'Computer Science', 'Physical Education'];
  const subjects = [];
  for (const name of subjectNames) {
    const sub = await prisma.subject.upsert({
      where: { schoolId_name: { schoolId: school.id, name } },
      update: {},
      create: { schoolId: school.id, name, code: name.toUpperCase().slice(0, 4) },
    });
    subjects.push(sub);
  }
  console.log(`✅ Subjects: ${subjectNames.join(', ')}`);

  // ─── Classes & Sections ───────────────────────────────────────────────────
  const classData = [
    { name: 'Class 9', level: 11 },
    { name: 'Class 10', level: 12 },
    { name: 'Class 11', level: 13 },
    { name: 'Class 12', level: 14 },
  ];

  const sections: any[] = [];
  for (const cls of classData) {
    const classRecord = await prisma.class.upsert({
      where: { schoolId_academicYearId_name: { schoolId: school.id, academicYearId: academicYear.id, name: cls.name } },
      update: {},
      create: {
        schoolId: school.id,
        academicYearId: academicYear.id,
        name: cls.name,
        numericLevel: cls.level,
      },
    });

    for (const secName of ['A', 'B']) {
      const section = await prisma.section.upsert({
        where: { classId_name: { classId: classRecord.id, name: secName } },
        update: {},
        create: { classId: classRecord.id, name: secName, capacity: 40 },
      });
      sections.push(section);
    }
  }
  console.log(`✅ Classes: ${classData.map(c => c.name).join(', ')} (2 sections each)`);

  // ─── Fee Heads ────────────────────────────────────────────────────────────
  const feeHeadData = [
    { name: 'Tuition Fee', sortOrder: 1 },
    { name: 'Development Fee', sortOrder: 2 },
    { name: 'Library Fee', sortOrder: 3 },
    { name: 'Sports Fee', sortOrder: 4 },
    { name: 'Computer Fee', sortOrder: 5 },
    { name: 'Examination Fee', sortOrder: 6 },
  ];

  for (const fh of feeHeadData) {
    await prisma.feeHead.upsert({
      where: { schoolId_name: { schoolId: school.id, name: fh.name } },
      update: {},
      create: { schoolId: school.id, name: fh.name, sortOrder: fh.sortOrder },
    });
  }
  console.log(`✅ Fee Heads: ${feeHeadData.map(f => f.name).join(', ')}`);

  // ─── Sample Students ──────────────────────────────────────────────────────
  const studentData = [
    { firstName: 'Arjun', lastName: 'Mehta', email: 'arjun.mehta@student.sunriseschool.edu.in', adm: 'ADM2026001' },
    { firstName: 'Priya', lastName: 'Sharma', email: 'priya.sharma@student.sunriseschool.edu.in', adm: 'ADM2026002' },
    { firstName: 'Rahul', lastName: 'Gupta', email: 'rahul.gupta@student.sunriseschool.edu.in', adm: 'ADM2026003' },
    { firstName: 'Sneha', lastName: 'Joshi', email: 'sneha.joshi@student.sunriseschool.edu.in', adm: 'ADM2026004' },
    { firstName: 'Vikas', lastName: 'Yadav', email: 'vikas.yadav@student.sunriseschool.edu.in', adm: 'ADM2026005' },
  ];

  for (const [idx, s] of studentData.entries()) {
    const user = await prisma.user.upsert({
      where: { email: s.email },
      update: {},
      create: {
        schoolId: school.id,
        email: s.email,
        passwordHash,
        role: UserRole.STUDENT,
        status: UserStatus.ACTIVE,
        firstName: s.firstName,
        lastName: s.lastName,
        emailVerified: true,
      },
    });

    const student = await prisma.student.upsert({
      where: { schoolId_admissionNumber: { schoolId: school.id, admissionNumber: s.adm } },
      update: {},
      create: {
        schoolId: school.id,
        userId: user.id,
        admissionNumber: s.adm,
        dateOfBirth: new Date(2010, idx % 12, (idx + 1) * 2),
        gender: idx % 2 === 0 ? 'MALE' : 'FEMALE',
        bloodGroup: BloodGroup.O_POSITIVE,
        nationality: 'Indian',
        admissionDate: new Date('2026-06-01'),
      },
    });

    // Enroll in first section (Class 9A)
    await prisma.studentEnrollment.upsert({
      where: { studentId_sectionId: { studentId: student.id, sectionId: sections[0].id } },
      update: {},
      create: {
        studentId: student.id,
        sectionId: sections[0].id,
        rollNumber: String(idx + 1).padStart(2, '0'),
        status: 'ACTIVE',
      },
    });

    // Add guardian
    await prisma.guardian.upsert({
      where: { id: `guard_${student.id}` },
      update: {},
      create: {
        id: `guard_${student.id}`,
        studentId: student.id,
        relationship: 'Father',
        firstName: 'Mr.',
        lastName: s.lastName,
        phone: `+91-98765${String(43200 + idx)}`,
        isPrimary: true,
      },
    });
  }
  console.log(`✅ Students: ${studentData.map(s => s.firstName).join(', ')}`);

  console.log('\n🎉 Seed completed successfully!\n');
  console.log('─'.repeat(50));
  console.log('Demo Credentials (all use password: Admin@1234)');
  console.log('─'.repeat(50));
  console.log('Super Admin  : superadmin@schoolerp.com');
  console.log('School Admin : admin@sunriseschool.edu.in');
  console.log('Principal    : principal@sunriseschool.edu.in');
  console.log('Teacher      : priya.patel@sunriseschool.edu.in');
  console.log('Student      : arjun.mehta@student.sunriseschool.edu.in');
  console.log('─'.repeat(50));
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
