-- ============================================================
-- Forward Migration: 20260921120000_canonical_academic_schema
-- Change #8E: Canonical Academic Schema & Safe Data Migration
-- ============================================================

-- 1. Add nullable columns for safe backfill
ALTER TABLE "teacher_assignments" ADD COLUMN IF NOT EXISTS "schoolId" TEXT;
ALTER TABLE "teacher_assignments" ADD COLUMN IF NOT EXISTS "schoolSubjectOfferingId" TEXT;
ALTER TABLE "student_enrollments" ADD COLUMN IF NOT EXISTS "academicYearId" TEXT;

-- 2. Deterministic Backfill: teacher_assignments.schoolId
-- Backfill from section -> class -> schoolId
UPDATE "teacher_assignments" ta
SET "schoolId" = c."schoolId"
FROM "sections" s
JOIN "classes" c ON s."classId" = c."id"
WHERE ta."sectionId" = s."id" AND ta."schoolId" IS NULL;

-- Fallback from staff.schoolId
UPDATE "teacher_assignments" ta
SET "schoolId" = st."schoolId"
FROM "staff" st
WHERE ta."staffId" = st."id" AND ta."schoolId" IS NULL;

-- 3. Deterministic Backfill: student_enrollments.academicYearId
UPDATE "student_enrollments" se
SET "academicYearId" = c."academicYearId"
FROM "sections" s
JOIN "classes" c ON s."classId" = c."id"
WHERE se."sectionId" = s."id" AND se."academicYearId" IS NULL;

-- 4. Enforce NOT NULL on teacher_assignments.schoolId after proven backfill
ALTER TABLE "teacher_assignments" ALTER COLUMN "schoolId" SET NOT NULL;

-- 5. Hardened Unique Constraints on TeacherAssignment (multi-year safe)
DROP INDEX IF EXISTS "teacher_assignments_staffId_sectionId_subjectId_key";
CREATE UNIQUE INDEX IF NOT EXISTS "teacher_assignments_academicYearId_staffId_sectionId_subjectId_key"
  ON "teacher_assignments"("academicYearId", "staffId", "sectionId", "subjectId");

-- 6. Partial Unique Indexes for Single-Active Rules
-- Single active academic year per school
CREATE UNIQUE INDEX IF NOT EXISTS "academic_years_single_active_idx"
  ON "academic_years"("schoolId") WHERE "isActive" = true;

-- Single class teacher per section per academic session
CREATE UNIQUE INDEX IF NOT EXISTS "teacher_assignments_class_teacher_unique_idx"
  ON "teacher_assignments"("academicYearId", "sectionId") WHERE "isClassTeacher" = true;

-- Single active enrollment per student per academic session
CREATE UNIQUE INDEX IF NOT EXISTS "student_enrollments_single_active_idx"
  ON "student_enrollments"("studentId", "academicYearId") WHERE "status" = 'ACTIVE';

-- 7. High-Performance Query & Tenant Indexes
CREATE INDEX IF NOT EXISTS "teacher_assignments_schoolId_academicYearId_idx"
  ON "teacher_assignments"("schoolId", "academicYearId");

CREATE INDEX IF NOT EXISTS "school_subject_offerings_schoolId_legacySubjectId_idx"
  ON "school_subject_offerings"("schoolId", "legacySubjectId");

CREATE INDEX IF NOT EXISTS "student_enrollments_studentId_academicYearId_idx"
  ON "student_enrollments"("studentId", "academicYearId");

-- 8. Foreign Key Constraints with Referential Integrity
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'classes_schoolId_fkey') THEN
    ALTER TABLE "classes" ADD CONSTRAINT "classes_schoolId_fkey"
      FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'school_subject_offerings_academicYearId_fkey') THEN
    ALTER TABLE "school_subject_offerings" ADD CONSTRAINT "school_subject_offerings_academicYearId_fkey"
      FOREIGN KEY ("academicYearId") REFERENCES "academic_years"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'student_subject_enrollments_academicYearId_fkey') THEN
    ALTER TABLE "student_subject_enrollments" ADD CONSTRAINT "student_subject_enrollments_academicYearId_fkey"
      FOREIGN KEY ("academicYearId") REFERENCES "academic_years"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'student_enrollments_academicYearId_fkey') THEN
    ALTER TABLE "student_enrollments" ADD CONSTRAINT "student_enrollments_academicYearId_fkey"
      FOREIGN KEY ("academicYearId") REFERENCES "academic_years"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'teacher_assignments_schoolId_fkey') THEN
    ALTER TABLE "teacher_assignments" ADD CONSTRAINT "teacher_assignments_schoolId_fkey"
      FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'teacher_assignments_academicYearId_fkey') THEN
    ALTER TABLE "teacher_assignments" ADD CONSTRAINT "teacher_assignments_academicYearId_fkey"
      FOREIGN KEY ("academicYearId") REFERENCES "academic_years"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'teacher_assignments_schoolSubjectOfferingId_fkey') THEN
    ALTER TABLE "teacher_assignments" ADD CONSTRAINT "teacher_assignments_schoolSubjectOfferingId_fkey"
      FOREIGN KEY ("schoolSubjectOfferingId") REFERENCES "school_subject_offerings"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- 9. CHECK Constraints for Academic Domain Invariants
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_academic_years_dates') THEN
    ALTER TABLE "academic_years" ADD CONSTRAINT "chk_academic_years_dates"
      CHECK ("startDate" < "endDate");
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_curriculum_subjects_grade_range') THEN
    ALTER TABLE "curriculum_subjects" ADD CONSTRAINT "chk_curriculum_subjects_grade_range"
      CHECK ("gradeFrom" <= "gradeTo" AND "gradeFrom" >= 1 AND "gradeTo" <= 12);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_curriculum_subjects_marks') THEN
    ALTER TABLE "curriculum_subjects" ADD CONSTRAINT "chk_curriculum_subjects_marks"
      CHECK ("passMarks" <= "maxMarks" AND "maxMarks" > 0);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_curriculum_subjects_periods') THEN
    ALTER TABLE "curriculum_subjects" ADD CONSTRAINT "chk_curriculum_subjects_periods"
      CHECK ("periodsPerWeek" > 0);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_school_subject_offerings_grade_range') THEN
    ALTER TABLE "school_subject_offerings" ADD CONSTRAINT "chk_school_subject_offerings_grade_range"
      CHECK ("gradeFrom" <= "gradeTo" AND "gradeFrom" >= 1 AND "gradeTo" <= 12);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_school_subject_offerings_marks') THEN
    ALTER TABLE "school_subject_offerings" ADD CONSTRAINT "chk_school_subject_offerings_marks"
      CHECK ("passMarks" <= "maxMarks" AND "maxMarks" > 0);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_school_subject_offerings_periods') THEN
    ALTER TABLE "school_subject_offerings" ADD CONSTRAINT "chk_school_subject_offerings_periods"
      CHECK ("periodsPerWeek" > 0);
  END IF;
END $$;
