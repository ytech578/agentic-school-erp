-- Restores domain tables that later hardening migrations depend on. These
-- entities existed in the application schema but were omitted from the
-- original migration history, breaking clean installs and restore drills.

CREATE TYPE "AdmissionStatus" AS ENUM (
  'SUBMITTED', 'UNDER_REVIEW', 'SHORTLISTED', 'INTERVIEW_SCHEDULED',
  'ACCEPTED', 'REJECTED', 'WAITLISTED', 'WITHDRAWN'
);
CREATE TYPE "EnquiryStatus" AS ENUM (
  'NEW', 'CONTACTED', 'INTERESTED', 'NOT_INTERESTED', 'CONVERTED'
);
CREATE TYPE "SlotType" AS ENUM ('CLASS', 'BREAK', 'ASSEMBLY', 'FREE', 'LAB');

CREATE TABLE "admission_enquiries" (
  "id" TEXT NOT NULL,
  "schoolId" TEXT NOT NULL,
  "academicYearId" TEXT NOT NULL,
  "studentName" TEXT NOT NULL,
  "dob" TIMESTAMP(3),
  "classApplied" TEXT NOT NULL,
  "parentName" TEXT NOT NULL,
  "phone" TEXT NOT NULL,
  "email" TEXT,
  "source" TEXT,
  "notes" TEXT,
  "followUpDate" TIMESTAMP(3),
  "status" "EnquiryStatus" NOT NULL DEFAULT 'NEW',
  "leadScore" INTEGER DEFAULT 0,
  "nextAction" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "admission_enquiries_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "admission_applications" (
  "id" TEXT NOT NULL,
  "schoolId" TEXT NOT NULL,
  "academicYearId" TEXT NOT NULL,
  "applicationNo" TEXT NOT NULL,
  "studentName" TEXT NOT NULL,
  "dateOfBirth" TIMESTAMP(3) NOT NULL,
  "gender" "Gender" NOT NULL,
  "religion" TEXT,
  "category" TEXT,
  "classApplied" TEXT NOT NULL,
  "previousSchool" TEXT,
  "parentName" TEXT NOT NULL,
  "parentEmail" TEXT,
  "parentPhone" TEXT NOT NULL,
  "address" TEXT,
  "status" "AdmissionStatus" NOT NULL DEFAULT 'SUBMITTED',
  "entranceScore" DOUBLE PRECISION,
  "interviewDate" TIMESTAMP(3),
  "interviewNotes" TEXT,
  "convertedStudentId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "admission_applications_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "admission_documents" (
  "id" TEXT NOT NULL,
  "applicationId" TEXT NOT NULL,
  "documentType" TEXT NOT NULL,
  "fileUrl" TEXT NOT NULL,
  "isVerified" BOOLEAN NOT NULL DEFAULT false,
  "verifiedBy" TEXT,
  "verifiedAt" TIMESTAMP(3),
  CONSTRAINT "admission_documents_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "timetable_slots" (
  "id" TEXT NOT NULL,
  "schoolId" TEXT NOT NULL,
  "academicYearId" TEXT NOT NULL,
  "classId" TEXT NOT NULL,
  "sectionId" TEXT,
  "dayOfWeek" INTEGER NOT NULL,
  "periodNumber" INTEGER NOT NULL,
  "startTime" TEXT NOT NULL,
  "endTime" TEXT NOT NULL,
  "subjectId" TEXT,
  "staffId" TEXT,
  "roomNumber" TEXT,
  "slotType" "SlotType" NOT NULL DEFAULT 'CLASS',
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "timetable_slots_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "assignments" (
  "id" TEXT NOT NULL,
  "schoolId" TEXT NOT NULL,
  "academicYearId" TEXT NOT NULL,
  "classId" TEXT NOT NULL,
  "sectionId" TEXT,
  "subjectId" TEXT NOT NULL,
  "staffId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "dueDate" TIMESTAMP(3) NOT NULL,
  "maxMarks" INTEGER,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "assignments_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "assignment_submissions" (
  "id" TEXT NOT NULL,
  "assignmentId" TEXT NOT NULL,
  "studentId" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "marksObtained" DECIMAL(5,2),
  "feedback" TEXT,
  "submittedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "assignment_submissions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "admission_applications_applicationNo_key"
  ON "admission_applications"("applicationNo");
CREATE UNIQUE INDEX "admission_applications_convertedStudentId_key"
  ON "admission_applications"("convertedStudentId");
CREATE INDEX "admission_enquiries_schoolId_idx" ON "admission_enquiries"("schoolId");
CREATE INDEX "admission_applications_schoolId_idx" ON "admission_applications"("schoolId");
CREATE INDEX "admission_documents_applicationId_idx" ON "admission_documents"("applicationId");
CREATE INDEX "timetable_slots_schoolId_academicYearId_idx" ON "timetable_slots"("schoolId", "academicYearId");
CREATE INDEX "timetable_slots_sectionId_dayOfWeek_idx" ON "timetable_slots"("sectionId", "dayOfWeek");
CREATE INDEX "timetable_slots_staffId_dayOfWeek_idx" ON "timetable_slots"("staffId", "dayOfWeek");
CREATE INDEX "assignments_schoolId_sectionId_idx" ON "assignments"("schoolId", "sectionId");
CREATE INDEX "assignments_staffId_idx" ON "assignments"("staffId");
CREATE UNIQUE INDEX "assignment_submissions_assignmentId_studentId_key"
  ON "assignment_submissions"("assignmentId", "studentId");

ALTER TABLE "admission_enquiries" ADD CONSTRAINT "admission_enquiries_schoolId_fkey"
  FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "admission_enquiries" ADD CONSTRAINT "admission_enquiries_academicYearId_fkey"
  FOREIGN KEY ("academicYearId") REFERENCES "academic_years"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "admission_applications" ADD CONSTRAINT "admission_applications_schoolId_fkey"
  FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "admission_applications" ADD CONSTRAINT "admission_applications_academicYearId_fkey"
  FOREIGN KEY ("academicYearId") REFERENCES "academic_years"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "admission_applications" ADD CONSTRAINT "admission_applications_convertedStudentId_fkey"
  FOREIGN KEY ("convertedStudentId") REFERENCES "students"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "admission_documents" ADD CONSTRAINT "admission_documents_applicationId_fkey"
  FOREIGN KEY ("applicationId") REFERENCES "admission_applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "timetable_slots" ADD CONSTRAINT "timetable_slots_schoolId_fkey"
  FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "timetable_slots" ADD CONSTRAINT "timetable_slots_academicYearId_fkey"
  FOREIGN KEY ("academicYearId") REFERENCES "academic_years"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "timetable_slots" ADD CONSTRAINT "timetable_slots_classId_fkey"
  FOREIGN KEY ("classId") REFERENCES "classes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "timetable_slots" ADD CONSTRAINT "timetable_slots_sectionId_fkey"
  FOREIGN KEY ("sectionId") REFERENCES "sections"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "timetable_slots" ADD CONSTRAINT "timetable_slots_subjectId_fkey"
  FOREIGN KEY ("subjectId") REFERENCES "subjects"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "timetable_slots" ADD CONSTRAINT "timetable_slots_staffId_fkey"
  FOREIGN KEY ("staffId") REFERENCES "staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "assignments" ADD CONSTRAINT "assignments_schoolId_fkey"
  FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "assignments" ADD CONSTRAINT "assignments_academicYearId_fkey"
  FOREIGN KEY ("academicYearId") REFERENCES "academic_years"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "assignments" ADD CONSTRAINT "assignments_classId_fkey"
  FOREIGN KEY ("classId") REFERENCES "classes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "assignments" ADD CONSTRAINT "assignments_sectionId_fkey"
  FOREIGN KEY ("sectionId") REFERENCES "sections"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "assignments" ADD CONSTRAINT "assignments_subjectId_fkey"
  FOREIGN KEY ("subjectId") REFERENCES "subjects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "assignments" ADD CONSTRAINT "assignments_staffId_fkey"
  FOREIGN KEY ("staffId") REFERENCES "staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "assignment_submissions" ADD CONSTRAINT "assignment_submissions_assignmentId_fkey"
  FOREIGN KEY ("assignmentId") REFERENCES "assignments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "assignment_submissions" ADD CONSTRAINT "assignment_submissions_studentId_fkey"
  FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
