/**
 * SEED SCRIPT 1C — Assignments + Submissions
 * Creates 2 assignments per subject per class (past 2 months).
 * Generates submissions for students with realistic marks and feedback.
 */
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

function randInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function daysAgo(n) { return new Date(Date.now() - n * 86400000); }

const assignmentTitles = {
  Mathematics: ['Algebraic Expressions Worksheet', 'Geometry Problem Set', 'Statistics Assignment', 'Trigonometry Practice'],
  Science: ['Lab Report: Photosynthesis', 'Chapter Summary: Force & Motion', 'Periodic Table Quiz', 'Acids & Bases Study'],
  'General Science': ['Ecosystem and Food Chain', 'Work & Energy Notes', 'Light and Shadows Lab'],
  'Physical Science': ['Laws of Motion Practice', 'Chemical Reactions Lab', 'Wave Optics Worksheet'],
  'Biological Science': ['Cell Structure & Organelles', 'Genetics Problem Set', 'Plant Physiology Notes'],
  English: ['Essay: Digital India and Education', 'Grammar & Punctuation Worksheet', 'Literature Analysis: The Road Not Taken'],
  'Social Studies': ['Map Activity: Drainage Systems of India', 'History: The Nationalist Movement', 'Civics: Indian Democratic Structure'],
  Hindi: ['Nibandh Lekhan: Paryavaran Sanrakshan', 'Vyakaran Abhyas Patrika', 'Kavita Bhavarth'],
  Telugu: ['Telugu Vyasa Rachana', 'Vyakaranamu Abhyasam', 'Padhyala Bhavalu'],
  Physics: ['Numericals: Rotational Dynamics', 'Optics Ray Diagrams', 'Thermodynamics Problem Set'],
  Chemistry: ['Balancing Redox Reactions', 'Organic Reaction Mechanisms', 'Electrochemistry Numericals'],
  Economics: ['National Income Calculation', 'Inflation & Monetary Policy', 'Market Structures Comparison'],
  'Computer Science': ['Python Data Structures Lab', 'SQL Query Practice Set', 'Object-Oriented Programming Project'],
  'Environmental Science': ['Solid Waste Management Study', 'Biodiversity Hotspots Report', 'Climate Change Impact'],
  default: ['Chapter Review Assignment', 'Concept Practice Worksheet', 'Subject Assessment'],
};

function getAssignmentTitle(subjectName, index) {
  const titles = assignmentTitles[subjectName] || assignmentTitles.default;
  return titles[index % titles.length];
}

async function main() {
  console.log('📝 Starting Assignments + Submissions Seeding...\n');

  const school = await prisma.school.findFirst({ where: { code: 'DEMO001' } });
  const sid = school.id;
  const ay = await prisma.academicYear.findFirst({ where: { schoolId: sid, isActive: true } });

  // Get staff members
  const staffList = await prisma.staff.findMany({
    where: { schoolId: sid, isActive: true },
    include: {
      teacherAssignments: {
        include: {
          section: { select: { classId: true } }
        }
      }
    }
  });

  const classes = await prisma.class.findMany({
    where: { schoolId: sid, academicYearId: ay.id },
    include: {
      subjects: { include: { subject: true } },
      sections: {
        include: {
          enrollments: { where: { status: 'ACTIVE' }, select: { studentId: true } }
        }
      }
    }
  });

  // Map of subjectId + classId → staffId
  const staffMap = {};
  for (const staff of staffList) {
    for (const ta of staff.teacherAssignments) {
      if (ta.section?.classId && ta.subjectId) {
        const key = `${ta.subjectId}_${ta.section.classId}`;
        staffMap[key] = staff.id;
      }
    }
  }

  const fallbackStaff = staffList[0]?.id;
  console.log(`Classes: ${classes.length} | Staff: ${staffList.length}\n`);

  let totalAssignments = 0;
  let totalSubmissions = 0;

  for (const cls of classes) {
    const studentIds = [...new Set(cls.sections.flatMap(s => s.enrollments.map(e => e.studentId)))];
    if (!studentIds.length || !cls.subjects.length) continue;

    for (const classSubject of cls.subjects) {
      const staffId = staffMap[`${classSubject.subjectId}_${cls.id}`] || fallbackStaff;
      if (!staffId) continue;

      // Create 2 assignments per subject
      for (let i = 0; i < 2; i++) {
        const dueDaysAgo = i === 0 ? randInt(25, 40) : randInt(8, 20);
        const dueDate = daysAgo(dueDaysAgo);
        const title = getAssignmentTitle(classSubject.subject.name, i);

        // Check if assignment already exists
        let assignment = await prisma.assignment.findFirst({
          where: { schoolId: sid, classId: cls.id, subjectId: classSubject.subjectId, title }
        });

        if (!assignment) {
          assignment = await prisma.assignment.create({
            data: {
              schoolId: sid,
              academicYearId: ay.id,
              classId: cls.id,
              subjectId: classSubject.subjectId,
              staffId,
              title,
              description: `Complete ${title} as instructed. Submit well-formatted notes and workings.`,
              dueDate,
              maxMarks: 20,
              isActive: true,
            }
          });
          totalAssignments++;
        }

        // Check if submissions already exist
        const subCount = await prisma.assignmentSubmission.count({ where: { assignmentId: assignment.id } });
        if (subCount > 0) continue;

        const submissionData = [];
        for (const studentId of studentIds) {
          const r = Math.random();
          let status, marksObtained, submittedAt, feedback;

          if (r < 0.72) {
            // Graded submission (72%)
            status = 'GRADED';
            marksObtained = randInt(12, 20);
            submittedAt = new Date(dueDate.getTime() - randInt(1, 3) * 86400000);
            feedback = marksObtained >= 17 ? 'Outstanding work! Very well structured.' : marksObtained >= 14 ? 'Good effort, concepts are clear.' : 'Average work, needs more practice.';
          } else if (r < 0.84) {
            // Submitted, awaiting grading (12%)
            status = 'SUBMITTED';
            marksObtained = null;
            submittedAt = new Date(dueDate.getTime() + randInt(0, 1) * 86400000);
            feedback = null;
          } else if (r < 0.92) {
            // Late submission (8%)
            status = 'LATE';
            marksObtained = randInt(8, 15);
            submittedAt = new Date(dueDate.getTime() + randInt(2, 6) * 86400000);
            feedback = 'Submitted after the due date.';
          } else {
            // Missing (8%)
            status = 'MISSING';
            marksObtained = null;
            submittedAt = null;
            feedback = null;
          }

          submissionData.push({
            assignmentId: assignment.id,
            studentId,
            status,
            marksObtained,
            feedback,
            submittedAt,
          });
        }

        await prisma.assignmentSubmission.createMany({ data: submissionData, skipDuplicates: true });
        totalSubmissions += submissionData.length;
      }
    }
    console.log(`  ✅ Class ${cls.name}: created assignments & submissions`);
  }

  console.log(`\n🎉 DONE!`);
  console.log(`   Assignments created: ${totalAssignments}`);
  console.log(`   Submissions created: ${totalSubmissions}`);
}

main().catch(e => {
  console.error('❌ Error:', e);
  process.exit(1);
}).finally(() => prisma.$disconnect());
