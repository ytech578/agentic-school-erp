-- ============================================================
-- Migration: 20260922130000_academic_integrity_closure
-- Change #8E Correction: Academic Database & Integrity Closure
-- ============================================================

-- 1. Backfill and enforce StudentEnrollment.academicYearId NOT NULL (Step 2)
UPDATE "student_enrollments" se
SET "academicYearId" = c."academicYearId"
FROM "sections" s
JOIN "classes" c ON c."id" = s."classId"
WHERE se."sectionId" = s."id"
  AND se."academicYearId" IS NULL;

DO $$
DECLARE
  null_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO null_count FROM "student_enrollments" WHERE "academicYearId" IS NULL;
  IF null_count > 0 THEN
    RAISE EXCEPTION 'Cannot enforce NOT NULL on student_enrollments.academicYearId: % row(s) still have NULL academicYearId', null_count;
  END IF;
END $$;

ALTER TABLE "student_enrollments" ALTER COLUMN "academicYearId" SET NOT NULL;

-- 2. Fix Student Enrollment Uniqueness (Step 3)
ALTER TABLE "student_enrollments" DROP CONSTRAINT IF EXISTS "student_enrollments_studentId_sectionId_key";
DROP INDEX IF EXISTS "student_enrollments_studentId_sectionId_key";

CREATE UNIQUE INDEX IF NOT EXISTS "student_enrollments_studentId_sectionId_academicYearId_key"
  ON "student_enrollments"("studentId", "sectionId", "academicYearId");

CREATE UNIQUE INDEX IF NOT EXISTS "student_enrollments_single_active_idx"
  ON "student_enrollments"("studentId", "academicYearId")
  WHERE "status" = 'ACTIVE';

CREATE INDEX IF NOT EXISTS "student_enrollments_studentId_academicYearId_status_idx"
  ON "student_enrollments"("studentId", "academicYearId", "status");

-- 3. Composite AcademicYear key & Delete Safety (Steps 4 & 5)
CREATE UNIQUE INDEX IF NOT EXISTS "academic_years_id_schoolId_key"
  ON "academic_years"("id", "schoolId");

-- Classes
ALTER TABLE "classes" DROP CONSTRAINT IF EXISTS "classes_academicYearId_fkey";
ALTER TABLE "classes" DROP CONSTRAINT IF EXISTS "classes_academicYearId_schoolId_fkey";
ALTER TABLE "classes" ADD CONSTRAINT "classes_academicYearId_schoolId_fkey"
  FOREIGN KEY ("academicYearId", "schoolId") REFERENCES "academic_years"("id", "schoolId")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- School Subject Offerings
ALTER TABLE "school_subject_offerings" DROP CONSTRAINT IF EXISTS "school_subject_offerings_academicYearId_fkey";
ALTER TABLE "school_subject_offerings" DROP CONSTRAINT IF EXISTS "school_subject_offerings_academicYearId_schoolId_fkey";
ALTER TABLE "school_subject_offerings" ADD CONSTRAINT "school_subject_offerings_academicYearId_schoolId_fkey"
  FOREIGN KEY ("academicYearId", "schoolId") REFERENCES "academic_years"("id", "schoolId")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- Student Subject Enrollments
ALTER TABLE "student_subject_enrollments" DROP CONSTRAINT IF EXISTS "student_subject_enrollments_academicYearId_fkey";
ALTER TABLE "student_subject_enrollments" ADD CONSTRAINT "student_subject_enrollments_academicYearId_fkey"
  FOREIGN KEY ("academicYearId") REFERENCES "academic_years"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- Student Enrollments
ALTER TABLE "student_enrollments" DROP CONSTRAINT IF EXISTS "student_enrollments_academicYearId_fkey";
ALTER TABLE "student_enrollments" ADD CONSTRAINT "student_enrollments_academicYearId_fkey"
  FOREIGN KEY ("academicYearId") REFERENCES "academic_years"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- Teacher Assignments
ALTER TABLE "teacher_assignments" DROP CONSTRAINT IF EXISTS "teacher_assignments_academicYearId_fkey";
ALTER TABLE "teacher_assignments" DROP CONSTRAINT IF EXISTS "teacher_assignments_academicYearId_schoolId_fkey";
ALTER TABLE "teacher_assignments" ADD CONSTRAINT "teacher_assignments_academicYearId_schoolId_fkey"
  FOREIGN KEY ("academicYearId", "schoolId") REFERENCES "academic_years"("id", "schoolId")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- Student Promotions
ALTER TABLE "student_promotions" DROP CONSTRAINT IF EXISTS "student_promotions_academicYearId_fkey";
ALTER TABLE "student_promotions" DROP CONSTRAINT IF EXISTS "student_promotions_academicYearId_schoolId_fkey";
ALTER TABLE "student_promotions" ADD CONSTRAINT "student_promotions_academicYearId_schoolId_fkey"
  FOREIGN KEY ("academicYearId", "schoolId") REFERENCES "academic_years"("id", "schoolId")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- Admission Enquiries
ALTER TABLE "admission_enquiries" DROP CONSTRAINT IF EXISTS "admission_enquiries_academicYearId_fkey";
ALTER TABLE "admission_enquiries" DROP CONSTRAINT IF EXISTS "admission_enquiries_academicYearId_schoolId_fkey";
ALTER TABLE "admission_enquiries" ADD CONSTRAINT "admission_enquiries_academicYearId_schoolId_fkey"
  FOREIGN KEY ("academicYearId", "schoolId") REFERENCES "academic_years"("id", "schoolId")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- Admission Applications
ALTER TABLE "admission_applications" DROP CONSTRAINT IF EXISTS "admission_applications_academicYearId_fkey";
ALTER TABLE "admission_applications" DROP CONSTRAINT IF EXISTS "admission_applications_academicYearId_schoolId_fkey";
ALTER TABLE "admission_applications" ADD CONSTRAINT "admission_applications_academicYearId_schoolId_fkey"
  FOREIGN KEY ("academicYearId", "schoolId") REFERENCES "academic_years"("id", "schoolId")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- Fee Structures
ALTER TABLE "fee_structures" DROP CONSTRAINT IF EXISTS "fee_structures_academicYearId_fkey";
ALTER TABLE "fee_structures" DROP CONSTRAINT IF EXISTS "fee_structures_academicYearId_schoolId_fkey";
ALTER TABLE "fee_structures" ADD CONSTRAINT "fee_structures_academicYearId_schoolId_fkey"
  FOREIGN KEY ("academicYearId", "schoolId") REFERENCES "academic_years"("id", "schoolId")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- Exams
ALTER TABLE "exams" DROP CONSTRAINT IF EXISTS "exams_academicYearId_fkey";
ALTER TABLE "exams" DROP CONSTRAINT IF EXISTS "exams_academicYearId_schoolId_fkey";
ALTER TABLE "exams" ADD CONSTRAINT "exams_academicYearId_schoolId_fkey"
  FOREIGN KEY ("academicYearId", "schoolId") REFERENCES "academic_years"("id", "schoolId")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- Timetable Slots
ALTER TABLE "timetable_slots" DROP CONSTRAINT IF EXISTS "timetable_slots_academicYearId_fkey";
ALTER TABLE "timetable_slots" DROP CONSTRAINT IF EXISTS "timetable_slots_academicYearId_schoolId_fkey";
ALTER TABLE "timetable_slots" ADD CONSTRAINT "timetable_slots_academicYearId_schoolId_fkey"
  FOREIGN KEY ("academicYearId", "schoolId") REFERENCES "academic_years"("id", "schoolId")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- Assignments
ALTER TABLE "assignments" DROP CONSTRAINT IF EXISTS "assignments_academicYearId_fkey";
ALTER TABLE "assignments" DROP CONSTRAINT IF EXISTS "assignments_academicYearId_schoolId_fkey";
ALTER TABLE "assignments" ADD CONSTRAINT "assignments_academicYearId_schoolId_fkey"
  FOREIGN KEY ("academicYearId", "schoolId") REFERENCES "academic_years"("id", "schoolId")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- 4. Teacher Assignment NULL-Safe Uniqueness (Step 11)
ALTER TABLE "teacher_assignments" DROP CONSTRAINT IF EXISTS "teacher_assignments_academicYearId_staffId_sectionId_subjectId_key";
DROP INDEX IF EXISTS "teacher_assignments_academicYearId_staffId_sectionId_subjectId_key";

-- Exactly one class teacher per section per academic session
CREATE UNIQUE INDEX IF NOT EXISTS "teacher_assignments_single_class_teacher_idx"
  ON "teacher_assignments"("academicYearId", "sectionId")
  WHERE "isClassTeacher" = true;

-- Unique homeroom assignment per teacher when subject and offering are NULL
CREATE UNIQUE INDEX IF NOT EXISTS "teacher_assignments_no_subject_idx"
  ON "teacher_assignments"("academicYearId", "staffId", "sectionId")
  WHERE "subjectId" IS NULL AND "schoolSubjectOfferingId" IS NULL;

-- Unique teacher assignment per offering
CREATE UNIQUE INDEX IF NOT EXISTS "teacher_assignments_offering_idx"
  ON "teacher_assignments"("academicYearId", "staffId", "sectionId", "schoolSubjectOfferingId")
  WHERE "schoolSubjectOfferingId" IS NOT NULL;

-- Unique teacher assignment per legacy subject
CREATE UNIQUE INDEX IF NOT EXISTS "teacher_assignments_legacy_subject_idx"
  ON "teacher_assignments"("academicYearId", "staffId", "sectionId", "subjectId")
  WHERE "subjectId" IS NOT NULL;

CREATE INDEX IF NOT EXISTS "teacher_assignments_academicYearId_staffId_sectionId_idx"
  ON "teacher_assignments"("academicYearId", "staffId", "sectionId");

-- 5. CHECK Constraints for Academic Domain Invariants (Step 14)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_classes_numeric_level') THEN
    ALTER TABLE "classes" ADD CONSTRAINT "chk_classes_numeric_level"
      CHECK ("numericLevel" >= 1 AND "numericLevel" <= 12);
  END IF;
END $$;

-- 6. Trigger Functions for Cross-Context Integrity (Step 13)
CREATE OR REPLACE FUNCTION fn_validate_teacher_assignment_context()
RETURNS TRIGGER AS $$
DECLARE
  sec_school_id TEXT;
  sec_year_id TEXT;
  stf_school_id TEXT;
BEGIN
  -- Verify section belongs to same school and academic year
  SELECT c."schoolId", c."academicYearId"
  INTO sec_school_id, sec_year_id
  FROM "sections" s
  JOIN "classes" c ON c."id" = s."classId"
  WHERE s."id" = NEW."sectionId";

  IF sec_school_id IS NULL THEN
    RAISE EXCEPTION 'Teacher assignment references invalid or orphan section %', NEW."sectionId";
  END IF;

  IF sec_school_id <> NEW."schoolId" THEN
    RAISE EXCEPTION 'Cross-school teacher assignment: section school % does not match assignment school %', sec_school_id, NEW."schoolId";
  END IF;

  IF sec_year_id <> NEW."academicYearId" THEN
    RAISE EXCEPTION 'Cross-year teacher assignment: section academic year % does not match assignment academic year %', sec_year_id, NEW."academicYearId";
  END IF;

  -- Verify staff belongs to same school
  SELECT st."schoolId" INTO stf_school_id
  FROM "staff" st
  WHERE st."id" = NEW."staffId";

  IF stf_school_id IS NOT NULL AND stf_school_id <> NEW."schoolId" THEN
    RAISE EXCEPTION 'Cross-school teacher assignment: staff school % does not match assignment school %', stf_school_id, NEW."schoolId";
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_validate_teacher_assignment_context ON "teacher_assignments";
CREATE TRIGGER trg_validate_teacher_assignment_context
  BEFORE INSERT OR UPDATE ON "teacher_assignments"
  FOR EACH ROW
  EXECUTE FUNCTION fn_validate_teacher_assignment_context();

CREATE OR REPLACE FUNCTION fn_validate_student_enrollment_context()
RETURNS TRIGGER AS $$
DECLARE
  sec_year_id TEXT;
  sec_school_id TEXT;
  stu_school_id TEXT;
BEGIN
  SELECT c."academicYearId", c."schoolId"
  INTO sec_year_id, sec_school_id
  FROM "sections" s
  JOIN "classes" c ON c."id" = s."classId"
  WHERE s."id" = NEW."sectionId";

  IF sec_year_id IS NULL THEN
    RAISE EXCEPTION 'Student enrollment references invalid or orphan section %', NEW."sectionId";
  END IF;

  IF sec_year_id <> NEW."academicYearId" THEN
    RAISE EXCEPTION 'Cross-year student enrollment: section academic year % does not match enrollment academic year %', sec_year_id, NEW."academicYearId";
  END IF;

  SELECT st."schoolId" INTO stu_school_id
  FROM "students" st
  WHERE st."id" = NEW."studentId";

  IF stu_school_id IS NOT NULL AND stu_school_id <> sec_school_id THEN
    RAISE EXCEPTION 'Cross-school student enrollment: student school % does not match section school %', stu_school_id, sec_school_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_validate_student_enrollment_context ON "student_enrollments";
CREATE TRIGGER trg_validate_student_enrollment_context
  BEFORE INSERT OR UPDATE ON "student_enrollments"
  FOR EACH ROW
  EXECUTE FUNCTION fn_validate_student_enrollment_context();
