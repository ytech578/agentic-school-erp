-- Creates the canonical academic entities required by the subsequent
-- integrity migration. This migration repairs the original clean-install
-- chain, which previously assumed these tables already existed.

CREATE TYPE "BoardCategory" AS ENUM ('CBSE', 'CISCE', 'STATE');
CREATE TYPE "SubjectClassification" AS ENUM (
  'CORE', 'LANGUAGE', 'ELECTIVE', 'ADDITIONAL', 'CO_CURRICULAR',
  'INTERNAL_ASSESSMENT', 'VOCATIONAL', 'OTHER'
);
CREATE TYPE "SubjectSelectionType" AS ENUM (
  'MANDATORY', 'OPTIONAL', 'ELECTIVE', 'CHOICE', 'ADDITIONAL'
);
CREATE TYPE "OfferingSource" AS ENUM ('CURRICULUM', 'SCHOOL_CUSTOM');

ALTER TABLE "schools"
  ADD COLUMN "boardId" TEXT,
  ADD COLUMN "activeCurriculumId" TEXT;

ALTER TABLE "students"
  ADD COLUMN "riskScore" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "riskLevel" "RiskLevel" NOT NULL DEFAULT 'NONE';

CREATE TABLE "boards" (
  "id" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "category" "BoardCategory" NOT NULL,
  "stateCode" TEXT,
  "country" TEXT NOT NULL DEFAULT 'India',
  "description" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "metadata" JSONB DEFAULT '{}',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "boards_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "curriculums" (
  "id" TEXT NOT NULL,
  "boardId" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "version" TEXT NOT NULL,
  "description" TEXT,
  "effectiveFrom" TIMESTAMP(3),
  "effectiveTo" TIMESTAMP(3),
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "metadata" JSONB DEFAULT '{}',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "curriculums_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "subject_groups" (
  "id" TEXT NOT NULL,
  "curriculumId" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "minSelection" INTEGER NOT NULL DEFAULT 0,
  "maxSelection" INTEGER,
  "isRequired" BOOLEAN NOT NULL DEFAULT true,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "metadata" JSONB DEFAULT '{}',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "subject_groups_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "global_subjects" (
  "id" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "category" "SubjectClassification" NOT NULL DEFAULT 'CORE',
  "description" TEXT,
  "isCommon" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "global_subjects_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "curriculum_subjects" (
  "id" TEXT NOT NULL,
  "curriculumId" TEXT NOT NULL,
  "globalSubjectId" TEXT NOT NULL,
  "subjectGroupId" TEXT,
  "subjectCode" TEXT NOT NULL,
  "displayName" TEXT NOT NULL,
  "gradeFrom" INTEGER NOT NULL,
  "gradeTo" INTEGER NOT NULL,
  "subjectType" "SubjectClassification" NOT NULL DEFAULT 'CORE',
  "selectionType" "SubjectSelectionType" NOT NULL DEFAULT 'MANDATORY',
  "theoryEnabled" BOOLEAN NOT NULL DEFAULT true,
  "practicalEnabled" BOOLEAN NOT NULL DEFAULT false,
  "internalAssessmentEnabled" BOOLEAN NOT NULL DEFAULT false,
  "examEnabled" BOOLEAN NOT NULL DEFAULT true,
  "maxMarks" INTEGER NOT NULL DEFAULT 100,
  "passMarks" INTEGER NOT NULL DEFAULT 35,
  "theoryMarks" INTEGER,
  "practicalMarks" INTEGER,
  "internalMarks" INTEGER,
  "periodsPerWeek" INTEGER NOT NULL DEFAULT 5,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "metadata" JSONB DEFAULT '{}',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "curriculum_subjects_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "school_subject_offerings" (
  "id" TEXT NOT NULL,
  "schoolId" TEXT NOT NULL,
  "curriculumId" TEXT NOT NULL,
  "academicYearId" TEXT NOT NULL,
  "curriculumSubjectId" TEXT,
  "globalSubjectId" TEXT NOT NULL,
  "legacySubjectId" TEXT,
  "customName" TEXT,
  "customCode" TEXT,
  "source" "OfferingSource" NOT NULL DEFAULT 'CURRICULUM',
  "gradeFrom" INTEGER NOT NULL,
  "gradeTo" INTEGER NOT NULL,
  "periodsPerWeek" INTEGER NOT NULL DEFAULT 5,
  "isOffered" BOOLEAN NOT NULL DEFAULT true,
  "subjectType" "SubjectClassification" NOT NULL DEFAULT 'CORE',
  "selectionType" "SubjectSelectionType" NOT NULL DEFAULT 'MANDATORY',
  "theoryEnabled" BOOLEAN NOT NULL DEFAULT true,
  "practicalEnabled" BOOLEAN NOT NULL DEFAULT false,
  "internalAssessmentEnabled" BOOLEAN NOT NULL DEFAULT false,
  "examEnabled" BOOLEAN NOT NULL DEFAULT true,
  "maxMarks" INTEGER NOT NULL DEFAULT 100,
  "passMarks" INTEGER NOT NULL DEFAULT 35,
  "metadata" JSONB DEFAULT '{}',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "school_subject_offerings_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "student_subject_enrollments" (
  "id" TEXT NOT NULL,
  "studentId" TEXT NOT NULL,
  "schoolSubjectOfferingId" TEXT NOT NULL,
  "academicYearId" TEXT NOT NULL,
  "enrollmentType" "SubjectSelectionType" NOT NULL DEFAULT 'MANDATORY',
  "status" "EnrollmentStatus" NOT NULL DEFAULT 'ACTIVE',
  "enrolledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "student_subject_enrollments_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "boards_code_key" ON "boards"("code");
CREATE INDEX "boards_category_stateCode_idx" ON "boards"("category", "stateCode");
CREATE UNIQUE INDEX "curriculums_code_key" ON "curriculums"("code");
CREATE INDEX "curriculums_boardId_isActive_idx" ON "curriculums"("boardId", "isActive");
CREATE UNIQUE INDEX "subject_groups_curriculumId_code_key" ON "subject_groups"("curriculumId", "code");
CREATE UNIQUE INDEX "global_subjects_code_key" ON "global_subjects"("code");
CREATE UNIQUE INDEX "curriculum_subjects_curriculumId_subjectCode_gradeFrom_gradeTo_key"
  ON "curriculum_subjects"("curriculumId", "subjectCode", "gradeFrom", "gradeTo");
CREATE INDEX "curriculum_subjects_curriculumId_gradeFrom_gradeTo_idx"
  ON "curriculum_subjects"("curriculumId", "gradeFrom", "gradeTo");
CREATE UNIQUE INDEX "school_subject_offerings_schoolId_academicYearId_globalSubjectId_gradeFrom_gradeTo_key"
  ON "school_subject_offerings"("schoolId", "academicYearId", "globalSubjectId", "gradeFrom", "gradeTo");
CREATE INDEX "school_subject_offerings_schoolId_academicYearId_isOffered_idx"
  ON "school_subject_offerings"("schoolId", "academicYearId", "isOffered");
CREATE UNIQUE INDEX "student_subject_enrollments_studentId_schoolSubjectOfferingId_academicYearId_key"
  ON "student_subject_enrollments"("studentId", "schoolSubjectOfferingId", "academicYearId");
CREATE INDEX "student_subject_enrollments_studentId_academicYearId_status_idx"
  ON "student_subject_enrollments"("studentId", "academicYearId", "status");

ALTER TABLE "schools" ADD CONSTRAINT "schools_boardId_fkey"
  FOREIGN KEY ("boardId") REFERENCES "boards"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "curriculums" ADD CONSTRAINT "curriculums_boardId_fkey"
  FOREIGN KEY ("boardId") REFERENCES "boards"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "subject_groups" ADD CONSTRAINT "subject_groups_curriculumId_fkey"
  FOREIGN KEY ("curriculumId") REFERENCES "curriculums"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "curriculum_subjects" ADD CONSTRAINT "curriculum_subjects_curriculumId_fkey"
  FOREIGN KEY ("curriculumId") REFERENCES "curriculums"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "curriculum_subjects" ADD CONSTRAINT "curriculum_subjects_globalSubjectId_fkey"
  FOREIGN KEY ("globalSubjectId") REFERENCES "global_subjects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "curriculum_subjects" ADD CONSTRAINT "curriculum_subjects_subjectGroupId_fkey"
  FOREIGN KEY ("subjectGroupId") REFERENCES "subject_groups"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "school_subject_offerings" ADD CONSTRAINT "school_subject_offerings_schoolId_fkey"
  FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "school_subject_offerings" ADD CONSTRAINT "school_subject_offerings_curriculumId_fkey"
  FOREIGN KEY ("curriculumId") REFERENCES "curriculums"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "school_subject_offerings" ADD CONSTRAINT "school_subject_offerings_curriculumSubjectId_fkey"
  FOREIGN KEY ("curriculumSubjectId") REFERENCES "curriculum_subjects"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "school_subject_offerings" ADD CONSTRAINT "school_subject_offerings_globalSubjectId_fkey"
  FOREIGN KEY ("globalSubjectId") REFERENCES "global_subjects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "school_subject_offerings" ADD CONSTRAINT "school_subject_offerings_legacySubjectId_fkey"
  FOREIGN KEY ("legacySubjectId") REFERENCES "subjects"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "student_subject_enrollments" ADD CONSTRAINT "student_subject_enrollments_studentId_fkey"
  FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "student_subject_enrollments" ADD CONSTRAINT "student_subject_enrollments_schoolSubjectOfferingId_fkey"
  FOREIGN KEY ("schoolSubjectOfferingId") REFERENCES "school_subject_offerings"("id") ON DELETE CASCADE ON UPDATE CASCADE;
