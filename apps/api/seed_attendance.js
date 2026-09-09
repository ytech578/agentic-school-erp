/**
 * SEED SCRIPT 1B — Student Attendance (Last 30 School Days)
 * Marks realistic attendance for all 705 students.
 * Distribution: 85% PRESENT, 8% ABSENT, 5% LATE, 2% EXCUSED
 */
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

function getSchoolDays(daysBack) {
  const days = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  let d = new Date(today);
  while (days.length < daysBack) {
    d = new Date(d.getTime() - 86400000);
    const dow = d.getDay();
    if (dow !== 0 && dow !== 6) { // Monday to Friday
      const schoolDay = new Date(d);
      schoolDay.setHours(0, 0, 0, 0);
      days.push(schoolDay);
    }
  }
  return days.reverse();
}

function randStatus() {
  const r = Math.random();
  if (r < 0.85) return 'PRESENT';
  if (r < 0.93) return 'ABSENT';
  if (r < 0.98) return 'LATE';
  return 'EXCUSED';
}

async function main() {
  console.log('📅 Student Attendance Seeding (last 30 school days)...\n');

  const school = await prisma.school.findFirst({ where: { code: 'DEMO001' } });
  const sid = school.id;
  const ay = await prisma.academicYear.findFirst({ where: { schoolId: sid, isActive: true } });
  const adminUser = await prisma.user.findFirst({ where: { schoolId: sid, role: 'SCHOOL_ADMIN' } });

  // Get active enrollments
  const enrollments = await prisma.studentEnrollment.findMany({
    where: {
      status: 'ACTIVE',
      section: { class: { schoolId: sid, academicYearId: ay.id } }
    },
    include: {
      student: { select: { id: true } },
      section: { select: { id: true } }
    }
  });

  console.log(`Active enrollments: ${enrollments.length}\n`);

  const schoolDays = getSchoolDays(30);
  console.log(`Seeding ${schoolDays.length} days: ${schoolDays[0].toDateString()} → ${schoolDays[schoolDays.length-1].toDateString()}\n`);

  let totalRecords = 0;
  let skippedDays = 0;

  for (const day of schoolDays) {
    const existing = await prisma.attendanceRecord.count({
      where: { schoolId: sid, date: day }
    });
    if (existing > 0) {
      console.log(`⏭️  ${day.toDateString()} already has ${existing} records`);
      skippedDays++;
      continue;
    }

    const records = enrollments.map(e => ({
      schoolId: sid,
      studentId: e.student.id,
      sectionId: e.section.id,
      date: day,
      status: randStatus(),
      method: 'MANUAL',
      markedById: adminUser.id,
    }));

    await prisma.attendanceRecord.createMany({ data: records, skipDuplicates: true });
    totalRecords += records.length;
    console.log(`  ✅ ${day.toDateString()}: ${records.length} records`);
  }

  const counts = await Promise.all(['PRESENT', 'ABSENT', 'LATE', 'EXCUSED'].map(s =>
    prisma.attendanceRecord.count({ where: { schoolId: sid, status: s } })
  ));

  console.log(`\n✅ DONE! New records: ${totalRecords} | Skipped days: ${skippedDays}`);
  console.log(`   PRESENT: ${counts[0]} | ABSENT: ${counts[1]} | LATE: ${counts[2]} | EXCUSED: ${counts[3]}`);
}

main().catch(e => {
  console.error('❌', e);
  process.exit(1);
}).finally(() => prisma.$disconnect());
