-- CreateEnum
CREATE TYPE "LeaveType" AS ENUM ('CASUAL', 'SICK', 'EARNED', 'MATERNITY', 'PATERNITY', 'UNPAID', 'COMPENSATORY');

-- CreateEnum
CREATE TYPE "LeaveStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PayrollCycleStatus" AS ENUM ('DRAFT', 'PROCESSING', 'APPROVED', 'PAID');

-- CreateEnum
CREATE TYPE "PayslipStatus" AS ENUM ('PENDING', 'PAID');

-- CreateEnum
CREATE TYPE "CertificateType" AS ENUM ('TRANSFER_CERTIFICATE', 'BONAFIDE', 'CHARACTER', 'STUDY_CONDUCT', 'MERIT', 'SPORTS');

-- CreateEnum
CREATE TYPE "PtmMode" AS ENUM ('IN_PERSON', 'VIRTUAL');

-- CreateEnum
CREATE TYPE "PtmSlotStatus" AS ENUM ('AVAILABLE', 'BOOKED', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "IncidentSeverity" AS ENUM ('MINOR', 'MODERATE', 'MAJOR', 'CRITICAL');

-- CreateEnum
CREATE TYPE "IncidentStatus" AS ENUM ('REPORTED', 'INVESTIGATING', 'RESOLVED', 'APPEALED', 'CLOSED');

-- CreateEnum
CREATE TYPE "SubscriptionPlan" AS ENUM ('FREE_PILOT', 'STARTER', 'GROWTH', 'ENTERPRISE');

-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('ACTIVE', 'TRIALING', 'PAST_DUE', 'CANCELLED');

-- CreateEnum
CREATE TYPE "QuestionType" AS ENUM ('MCQ', 'TRUE_FALSE', 'SHORT_ANSWER', 'DESCRIPTIVE');

-- AlterEnum
ALTER TYPE "AttendanceStatus" ADD VALUE 'HALF_DAY';

-- DropForeignKey
ALTER TABLE "assignments" DROP CONSTRAINT "assignments_subjectId_fkey";

-- DropForeignKey
ALTER TABLE "exam_subjects" DROP CONSTRAINT "exam_subjects_subjectId_fkey";

-- DropIndex
DROP INDEX "assignments_schoolSubjectOfferingId_idx";

-- DropIndex
DROP INDEX "exam_subjects_examId_classId_idx";

-- DropIndex
DROP INDEX "exam_subjects_examId_subjectId_classId_key";

-- DropIndex
DROP INDEX "student_enrollments_studentId_academicYearId_idx";

-- AlterTable
ALTER TABLE "agent_actions" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "assignments" ADD COLUMN     "departmentId" TEXT;

-- AlterTable
ALTER TABLE "sections" ADD COLUMN     "departmentId" TEXT;

-- AlterTable
ALTER TABLE "timetable_slots" ADD COLUMN     "departmentId" TEXT;

-- CreateTable
CREATE TABLE "leave_requests" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "leaveType" "LeaveType" NOT NULL,
    "startDate" DATE NOT NULL,
    "endDate" DATE NOT NULL,
    "totalDays" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "status" "LeaveStatus" NOT NULL DEFAULT 'PENDING',
    "reviewedBy" TEXT,
    "reviewNote" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "leave_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "faculty_substitutions" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "originalStaffId" TEXT NOT NULL,
    "substituteStaffId" TEXT NOT NULL,
    "slotId" TEXT,
    "periodNumber" INTEGER NOT NULL,
    "time" TEXT,
    "className" TEXT,
    "subjectName" TEXT,
    "status" TEXT NOT NULL DEFAULT 'CONFIRMED',
    "notes" TEXT,
    "confirmedBy" TEXT,
    "confirmedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "faculty_substitutions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "activities" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "event" TEXT,
    "date" DATE NOT NULL,
    "icon" TEXT NOT NULL DEFAULT 'award',
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "activities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agent_alerts" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "actionLabel" TEXT,
    "actionRoute" TEXT,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "agent_alerts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "salary_structures" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "basicSalary" DOUBLE PRECISION NOT NULL,
    "da" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "hra" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "conveyance" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "medicalAllowance" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "specialAllowance" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "epfApplicable" BOOLEAN NOT NULL DEFAULT true,
    "esiApplicable" BOOLEAN NOT NULL DEFAULT false,
    "professionalTax" DOUBLE PRECISION NOT NULL DEFAULT 200,
    "tdsMonthly" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "effectiveFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "salary_structures_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payroll_cycles" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "month" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "workingDays" INTEGER NOT NULL DEFAULT 30,
    "status" "PayrollCycleStatus" NOT NULL DEFAULT 'DRAFT',
    "totalGross" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalDeductions" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalNet" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "processedBy" TEXT,
    "approvedBy" TEXT,
    "processedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payroll_cycles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payslips" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "cycleId" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "payslipNumber" TEXT NOT NULL,
    "presentDays" DOUBLE PRECISION NOT NULL,
    "lossOfPayDays" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "basicSalary" DOUBLE PRECISION NOT NULL,
    "da" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "hra" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "allowances" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "grossSalary" DOUBLE PRECISION NOT NULL,
    "epfDeduction" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "esiDeduction" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "ptDeduction" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "tdsDeduction" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "otherDeductions" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalDeductions" DOUBLE PRECISION NOT NULL,
    "netSalary" DOUBLE PRECISION NOT NULL,
    "paymentStatus" "PayslipStatus" NOT NULL DEFAULT 'PENDING',
    "paymentMethod" TEXT,
    "paymentRef" TEXT,
    "paidAt" TIMESTAMP(3),
    "remarks" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payslips_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "certificate_templates" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "type" "CertificateType" NOT NULL,
    "name" TEXT NOT NULL,
    "headerText" TEXT,
    "bodyTemplate" TEXT NOT NULL,
    "footerText" TEXT,
    "signatoryTitle" TEXT NOT NULL DEFAULT 'Principal',
    "includeQrCode" BOOLEAN NOT NULL DEFAULT true,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "certificate_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "issued_certificates" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "templateId" TEXT,
    "studentId" TEXT NOT NULL,
    "certificateNumber" TEXT NOT NULL,
    "type" "CertificateType" NOT NULL,
    "issueDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reason" TEXT,
    "leavingReason" TEXT,
    "conductRemark" TEXT DEFAULT 'Good',
    "remarks" TEXT,
    "verificationHash" TEXT NOT NULL,
    "pdfUrl" TEXT,
    "issuedByUserId" TEXT NOT NULL,
    "isRevoked" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "issued_certificates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ptm_sessions" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "date" TIMESTAMP(3) NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "slotDuration" INTEGER NOT NULL DEFAULT 15,
    "mode" "PtmMode" NOT NULL DEFAULT 'IN_PERSON',
    "meetingLink" TEXT,
    "location" TEXT,
    "classId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ptm_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ptm_slots" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "studentId" TEXT,
    "parentId" TEXT,
    "status" "PtmSlotStatus" NOT NULL DEFAULT 'AVAILABLE',
    "parentNotes" TEXT,
    "teacherNotes" TEXT,
    "actionItems" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ptm_slots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "discipline_incidents" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "incidentNumber" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "severity" "IncidentSeverity" NOT NULL DEFAULT 'MINOR',
    "status" "IncidentStatus" NOT NULL DEFAULT 'REPORTED',
    "incidentDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "location" TEXT,
    "studentId" TEXT NOT NULL,
    "reportedByStaffId" TEXT NOT NULL,
    "actionTaken" TEXT,
    "actionExpiryDate" TIMESTAMP(3),
    "parentNotified" BOOLEAN NOT NULL DEFAULT false,
    "parentNotifiedAt" TIMESTAMP(3),
    "isConfidential" BOOLEAN NOT NULL DEFAULT false,
    "resolutionNotes" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "discipline_incidents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "device_tokens" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "device_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "data_consents" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "guardianId" TEXT NOT NULL,
    "consentType" TEXT NOT NULL,
    "isGranted" BOOLEAN NOT NULL DEFAULT false,
    "grantedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "ipAddress" TEXT,
    "consentNoticeVersion" TEXT NOT NULL DEFAULT '1.0',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "data_consents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "data_privacy_requests" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "requestType" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "exportDownloadUrl" TEXT,
    "rejectionReason" TEXT,
    "processedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "data_privacy_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "school_subscriptions" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "plan" "SubscriptionPlan" NOT NULL DEFAULT 'FREE_PILOT',
    "status" "SubscriptionStatus" NOT NULL DEFAULT 'ACTIVE',
    "maxStudents" INTEGER NOT NULL DEFAULT 200,
    "maxStaff" INTEGER NOT NULL DEFAULT 30,
    "maxStorageGb" DOUBLE PRECISION NOT NULL DEFAULT 5.0,
    "maxAiTokensMonthly" INTEGER NOT NULL DEFAULT 500000,
    "currentAiTokensUsed" INTEGER NOT NULL DEFAULT 0,
    "currentStorageGbUsed" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "startDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "renewsAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "school_subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "question_bank" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "subjectId" TEXT,
    "classId" TEXT,
    "questionText" TEXT NOT NULL,
    "type" "QuestionType" NOT NULL DEFAULT 'MCQ',
    "options" JSONB,
    "correctAnswer" TEXT NOT NULL,
    "explanation" TEXT,
    "marks" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "difficulty" TEXT NOT NULL DEFAULT 'MEDIUM',
    "tags" TEXT[],
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "question_bank_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "online_exams" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "subjectId" TEXT,
    "classId" TEXT,
    "durationMinutes" INTEGER NOT NULL DEFAULT 60,
    "totalMarks" DOUBLE PRECISION NOT NULL,
    "passMarks" DOUBLE PRECISION NOT NULL,
    "startTime" TIMESTAMP(3) NOT NULL,
    "endTime" TIMESTAMP(3) NOT NULL,
    "questions" JSONB NOT NULL,
    "isPublished" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "online_exams_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "online_exam_submissions" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "examId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "answers" JSONB NOT NULL,
    "score" DOUBLE PRECISION,
    "isGraded" BOOLEAN NOT NULL DEFAULT false,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "submittedAt" TIMESTAMP(3),
    "feedback" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "online_exam_submissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "alumni_profiles" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "graduationYear" INTEGER NOT NULL,
    "currentStatus" TEXT,
    "higherEducationInst" TEXT,
    "degree" TEXT,
    "company" TEXT,
    "designation" TEXT,
    "linkedInUrl" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "city" TEXT,
    "country" TEXT NOT NULL DEFAULT 'India',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "alumni_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transcript_requests" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "requestNumber" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "deliveryMode" TEXT NOT NULL DEFAULT 'DIGITAL',
    "status" TEXT NOT NULL DEFAULT 'SUBMITTED',
    "documentUrl" TEXT,
    "trackingNumber" TEXT,
    "remarks" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "transcript_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "leave_requests_schoolId_status_idx" ON "leave_requests"("schoolId", "status");

-- CreateIndex
CREATE INDEX "leave_requests_staffId_idx" ON "leave_requests"("staffId");

-- CreateIndex
CREATE INDEX "faculty_substitutions_schoolId_date_idx" ON "faculty_substitutions"("schoolId", "date");

-- CreateIndex
CREATE INDEX "faculty_substitutions_substituteStaffId_date_idx" ON "faculty_substitutions"("substituteStaffId", "date");

-- CreateIndex
CREATE INDEX "faculty_substitutions_originalStaffId_date_idx" ON "faculty_substitutions"("originalStaffId", "date");

-- CreateIndex
CREATE INDEX "activities_schoolId_studentId_idx" ON "activities"("schoolId", "studentId");

-- CreateIndex
CREATE INDEX "agent_alerts_schoolId_isRead_idx" ON "agent_alerts"("schoolId", "isRead");

-- CreateIndex
CREATE UNIQUE INDEX "salary_structures_staffId_key" ON "salary_structures"("staffId");

-- CreateIndex
CREATE INDEX "salary_structures_schoolId_idx" ON "salary_structures"("schoolId");

-- CreateIndex
CREATE INDEX "payroll_cycles_schoolId_idx" ON "payroll_cycles"("schoolId");

-- CreateIndex
CREATE UNIQUE INDEX "payroll_cycles_schoolId_month_year_key" ON "payroll_cycles"("schoolId", "month", "year");

-- CreateIndex
CREATE INDEX "payslips_schoolId_staffId_idx" ON "payslips"("schoolId", "staffId");

-- CreateIndex
CREATE UNIQUE INDEX "payslips_cycleId_staffId_key" ON "payslips"("cycleId", "staffId");

-- CreateIndex
CREATE INDEX "certificate_templates_schoolId_type_idx" ON "certificate_templates"("schoolId", "type");

-- CreateIndex
CREATE UNIQUE INDEX "issued_certificates_verificationHash_key" ON "issued_certificates"("verificationHash");

-- CreateIndex
CREATE INDEX "issued_certificates_schoolId_studentId_idx" ON "issued_certificates"("schoolId", "studentId");

-- CreateIndex
CREATE INDEX "issued_certificates_verificationHash_idx" ON "issued_certificates"("verificationHash");

-- CreateIndex
CREATE UNIQUE INDEX "issued_certificates_schoolId_certificateNumber_key" ON "issued_certificates"("schoolId", "certificateNumber");

-- CreateIndex
CREATE INDEX "ptm_sessions_schoolId_date_idx" ON "ptm_sessions"("schoolId", "date");

-- CreateIndex
CREATE INDEX "ptm_slots_schoolId_teacherId_idx" ON "ptm_slots"("schoolId", "teacherId");

-- CreateIndex
CREATE INDEX "ptm_slots_schoolId_studentId_idx" ON "ptm_slots"("schoolId", "studentId");

-- CreateIndex
CREATE UNIQUE INDEX "ptm_slots_sessionId_teacherId_startTime_key" ON "ptm_slots"("sessionId", "teacherId", "startTime");

-- CreateIndex
CREATE INDEX "discipline_incidents_schoolId_studentId_idx" ON "discipline_incidents"("schoolId", "studentId");

-- CreateIndex
CREATE INDEX "discipline_incidents_schoolId_status_idx" ON "discipline_incidents"("schoolId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "discipline_incidents_schoolId_incidentNumber_key" ON "discipline_incidents"("schoolId", "incidentNumber");

-- CreateIndex
CREATE UNIQUE INDEX "device_tokens_token_key" ON "device_tokens"("token");

-- CreateIndex
CREATE INDEX "device_tokens_userId_idx" ON "device_tokens"("userId");

-- CreateIndex
CREATE INDEX "device_tokens_schoolId_idx" ON "device_tokens"("schoolId");

-- CreateIndex
CREATE INDEX "data_consents_schoolId_consentType_idx" ON "data_consents"("schoolId", "consentType");

-- CreateIndex
CREATE UNIQUE INDEX "data_consents_studentId_consentType_key" ON "data_consents"("studentId", "consentType");

-- CreateIndex
CREATE INDEX "data_privacy_requests_schoolId_userId_idx" ON "data_privacy_requests"("schoolId", "userId");

-- CreateIndex
CREATE INDEX "data_privacy_requests_schoolId_status_idx" ON "data_privacy_requests"("schoolId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "school_subscriptions_schoolId_key" ON "school_subscriptions"("schoolId");

-- CreateIndex
CREATE INDEX "question_bank_schoolId_subjectId_idx" ON "question_bank"("schoolId", "subjectId");

-- CreateIndex
CREATE INDEX "question_bank_schoolId_classId_idx" ON "question_bank"("schoolId", "classId");

-- CreateIndex
CREATE INDEX "online_exams_schoolId_classId_idx" ON "online_exams"("schoolId", "classId");

-- CreateIndex
CREATE INDEX "online_exam_submissions_schoolId_studentId_idx" ON "online_exam_submissions"("schoolId", "studentId");

-- CreateIndex
CREATE UNIQUE INDEX "online_exam_submissions_examId_studentId_key" ON "online_exam_submissions"("examId", "studentId");

-- CreateIndex
CREATE UNIQUE INDEX "alumni_profiles_studentId_key" ON "alumni_profiles"("studentId");

-- CreateIndex
CREATE INDEX "alumni_profiles_schoolId_graduationYear_idx" ON "alumni_profiles"("schoolId", "graduationYear");

-- CreateIndex
CREATE INDEX "transcript_requests_schoolId_studentId_idx" ON "transcript_requests"("schoolId", "studentId");

-- CreateIndex
CREATE UNIQUE INDEX "transcript_requests_schoolId_requestNumber_key" ON "transcript_requests"("schoolId", "requestNumber");

-- CreateIndex
CREATE INDEX "exam_subjects_examId_idx" ON "exam_subjects"("examId");

-- CreateIndex
CREATE INDEX "exam_subjects_classId_idx" ON "exam_subjects"("classId");

-- CreateIndex
CREATE INDEX "exam_subjects_subjectId_idx" ON "exam_subjects"("subjectId");

-- CreateIndex
CREATE INDEX "fee_payments_schoolId_transactionRef_idx" ON "fee_payments"("schoolId", "transactionRef");

-- CreateIndex
CREATE INDEX "schools_boardId_idx" ON "schools"("boardId");

-- AddForeignKey
ALTER TABLE "sections" ADD CONSTRAINT "sections_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "students" ADD CONSTRAINT "students_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leave_requests" ADD CONSTRAINT "leave_requests_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "staff"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leave_requests" ADD CONSTRAINT "leave_requests_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exam_subjects" ADD CONSTRAINT "exam_subjects_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "subjects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exam_subjects" ADD CONSTRAINT "exam_subjects_classId_fkey" FOREIGN KEY ("classId") REFERENCES "classes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "timetable_slots" ADD CONSTRAINT "timetable_slots_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "faculty_substitutions" ADD CONSTRAINT "faculty_substitutions_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "faculty_substitutions" ADD CONSTRAINT "faculty_substitutions_originalStaffId_fkey" FOREIGN KEY ("originalStaffId") REFERENCES "staff"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "faculty_substitutions" ADD CONSTRAINT "faculty_substitutions_substituteStaffId_fkey" FOREIGN KEY ("substituteStaffId") REFERENCES "staff"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "faculty_substitutions" ADD CONSTRAINT "faculty_substitutions_slotId_fkey" FOREIGN KEY ("slotId") REFERENCES "timetable_slots"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assignments" ADD CONSTRAINT "assignments_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "subjects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assignments" ADD CONSTRAINT "assignments_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activities" ADD CONSTRAINT "activities_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activities" ADD CONSTRAINT "activities_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_alerts" ADD CONSTRAINT "agent_alerts_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "salary_structures" ADD CONSTRAINT "salary_structures_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "staff"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payslips" ADD CONSTRAINT "payslips_cycleId_fkey" FOREIGN KEY ("cycleId") REFERENCES "payroll_cycles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payslips" ADD CONSTRAINT "payslips_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "issued_certificates" ADD CONSTRAINT "issued_certificates_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "issued_certificates" ADD CONSTRAINT "issued_certificates_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "certificate_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ptm_slots" ADD CONSTRAINT "ptm_slots_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "ptm_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ptm_slots" ADD CONSTRAINT "ptm_slots_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ptm_slots" ADD CONSTRAINT "ptm_slots_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "discipline_incidents" ADD CONSTRAINT "discipline_incidents_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "discipline_incidents" ADD CONSTRAINT "discipline_incidents_reportedByStaffId_fkey" FOREIGN KEY ("reportedByStaffId") REFERENCES "staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "device_tokens" ADD CONSTRAINT "device_tokens_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "data_consents" ADD CONSTRAINT "data_consents_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "school_subscriptions" ADD CONSTRAINT "school_subscriptions_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "online_exam_submissions" ADD CONSTRAINT "online_exam_submissions_examId_fkey" FOREIGN KEY ("examId") REFERENCES "online_exams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "online_exam_submissions" ADD CONSTRAINT "online_exam_submissions_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alumni_profiles" ADD CONSTRAINT "alumni_profiles_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transcript_requests" ADD CONSTRAINT "transcript_requests_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- RenameIndex
ALTER INDEX "curriculum_subjects_curriculumId_subjectCode_gradeFrom_gradeTo_" RENAME TO "curriculum_subjects_curriculumId_subjectCode_gradeFrom_grad_key";

-- RenameIndex
ALTER INDEX "school_subject_offerings_schoolId_academicYearId_globalSubjectI" RENAME TO "school_subject_offerings_schoolId_academicYearId_globalSubj_key";

-- RenameIndex
ALTER INDEX "student_subject_enrollments_studentId_schoolSubjectOfferingId_a" RENAME TO "student_subject_enrollments_studentId_schoolSubjectOffering_key";

-- Re-apply the tenant policy after introducing domain tables in this
-- reconciliation migration. The enterprise security migration ran earlier,
-- so newly-created tables with schoolId must be enrolled explicitly.
DO $$
DECLARE
  tenant_table RECORD;
BEGIN
  FOR tenant_table IN
    SELECT DISTINCT table_name
    FROM information_schema.columns
    WHERE table_schema = 'public' AND column_name = 'schoolId'
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', tenant_table.table_name);
    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation ON public.%I', tenant_table.table_name);
    EXECUTE format(
      'CREATE POLICY tenant_isolation ON public.%I USING (app_security.has_tenant_access("schoolId")) WITH CHECK (app_security.has_tenant_access("schoolId"))',
      tenant_table.table_name
    );
  END LOOP;
END $$;

