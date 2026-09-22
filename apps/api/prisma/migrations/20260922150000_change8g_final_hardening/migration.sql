-- ============================================================
-- Migration: 20260922150000_change8g_final_hardening
-- 1. Reconcile AgentAction columns & constraints:
--    - Adds idempotencyScope, requestFingerprint, operationFingerprint if missing
--    - Safely drops old global UNIQUE(idempotencyKey)
--    - Enforces scoped UNIQUE(idempotencyScope, idempotencyKey)
--    - Safely drops old global UNIQUE(operationFingerprint)
--    - Creates partial UNIQUE index on active/succeeded operationFingerprint
-- 2. StudentSubjectEnrollment Cross-Context Integrity Trigger:
--    - Enforces Student.schoolId = Offering.schoolId AND
--      StudentSubjectEnrollment.academicYearId = Offering.academicYearId.
-- 3. TeacherAssignment Context Integrity Trigger Extension:
--    - Enforces Offering.schoolId = TeacherAssignment.schoolId AND
--      Offering.academicYearId = TeacherAssignment.academicYearId.
-- Safe on existing data; forward-only and idempotent.
-- ============================================================

-- 1. AgentAction Columns & Idempotency Reconciliation (Area A1)
ALTER TABLE "agent_actions"
  ADD COLUMN IF NOT EXISTS "idempotencyScope" TEXT,
  ADD COLUMN IF NOT EXISTS "requestFingerprint" TEXT,
  ADD COLUMN IF NOT EXISTS "operationFingerprint" TEXT;

-- Backfill idempotencyScope for existing rows where missing
UPDATE "agent_actions"
SET "idempotencyScope" = "schoolId" || ':' || "userId" || ':' || "toolName"
WHERE "idempotencyKey" IS NOT NULL AND "idempotencyScope" IS NULL;

-- Safely drop old global unique constraint on idempotencyKey
ALTER TABLE "agent_actions"
  DROP CONSTRAINT IF EXISTS "agent_actions_idempotencyKey_key";
DROP INDEX IF EXISTS "agent_actions_idempotencyKey_key";

-- Enforce composite unique constraint on (idempotencyScope, idempotencyKey)
DO $$ BEGIN
  ALTER TABLE "agent_actions"
    ADD CONSTRAINT "agent_actions_idempotencyScope_idempotencyKey_key"
    UNIQUE ("idempotencyScope", "idempotencyKey");
EXCEPTION
  WHEN duplicate_object THEN null;
  WHEN duplicate_table   THEN null;
END $$;

-- Drop obsolete global unique constraint on operationFingerprint
ALTER TABLE "agent_actions"
  DROP CONSTRAINT IF EXISTS "agent_actions_operationFingerprint_key";
DROP INDEX IF EXISTS "agent_actions_operationFingerprint_key";

-- Create partial unique index on active or completed action fingerprints
CREATE UNIQUE INDEX IF NOT EXISTS "agent_actions_active_operation_fingerprint_idx"
  ON "agent_actions"("operationFingerprint")
  WHERE "status" IN ('PROPOSED', 'AWAITING_CONFIRMATION', 'CONFIRMED', 'EXECUTING', 'SUCCEEDED');

-- Add supporting indexes for lookup performance
CREATE INDEX IF NOT EXISTS "agent_actions_operationFingerprint_idx"
  ON "agent_actions"("operationFingerprint");

CREATE INDEX IF NOT EXISTS "agent_actions_idempotencyScope_idx"
  ON "agent_actions"("idempotencyScope");

CREATE INDEX IF NOT EXISTS "agent_actions_requestFingerprint_idx"
  ON "agent_actions"("requestFingerprint");

-- 2. StudentSubjectEnrollment Cross-Context Integrity Trigger (Area B1)
CREATE OR REPLACE FUNCTION fn_validate_student_subject_enrollment_context()
RETURNS TRIGGER AS $$
DECLARE
  stu_school_id TEXT;
  off_school_id TEXT;
  off_year_id TEXT;
BEGIN
  -- 1. Fetch Student schoolId
  SELECT st."schoolId" INTO stu_school_id
  FROM "students" st
  WHERE st."id" = NEW."studentId";

  IF stu_school_id IS NULL THEN
    RAISE EXCEPTION 'StudentSubjectEnrollment references invalid or non-existent student %', NEW."studentId";
  END IF;

  -- 2. Fetch Offering schoolId and academicYearId
  SELECT off."schoolId", off."academicYearId"
  INTO off_school_id, off_year_id
  FROM "school_subject_offerings" off
  WHERE off."id" = NEW."schoolSubjectOfferingId";

  IF off_school_id IS NULL THEN
    RAISE EXCEPTION 'StudentSubjectEnrollment references invalid or non-existent offering %', NEW."schoolSubjectOfferingId";
  END IF;

  -- Invariant: Student.schoolId = Offering.schoolId
  IF stu_school_id <> off_school_id THEN
    RAISE EXCEPTION 'Cross-school student subject enrollment: student school % does not match offering school %', stu_school_id, off_school_id;
  END IF;

  -- Invariant: StudentSubjectEnrollment.academicYearId = Offering.academicYearId
  IF NEW."academicYearId" <> off_year_id THEN
    RAISE EXCEPTION 'Cross-year student subject enrollment: enrollment academic year % does not match offering academic year %', NEW."academicYearId", off_year_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_validate_student_subject_enrollment_context ON "student_subject_enrollments";
CREATE TRIGGER trg_validate_student_subject_enrollment_context
  BEFORE INSERT OR UPDATE ON "student_subject_enrollments"
  FOR EACH ROW
  EXECUTE FUNCTION fn_validate_student_subject_enrollment_context();

-- 3. TeacherAssignment Context Integrity Trigger (Area B2 Extension)
CREATE OR REPLACE FUNCTION fn_validate_teacher_assignment_context()
RETURNS TRIGGER AS $$
DECLARE
  sec_school_id TEXT;
  sec_year_id TEXT;
  stf_school_id TEXT;
  off_school_id TEXT;
  off_year_id TEXT;
BEGIN
  -- Verify section exists and fetch its class context
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

  -- Verify offering belongs to same school and academic year if populated
  IF NEW."schoolSubjectOfferingId" IS NOT NULL THEN
    SELECT off."schoolId", off."academicYearId"
    INTO off_school_id, off_year_id
    FROM "school_subject_offerings" off
    WHERE off."id" = NEW."schoolSubjectOfferingId";

    IF off_school_id IS NULL THEN
      RAISE EXCEPTION 'Teacher assignment references invalid offering %', NEW."schoolSubjectOfferingId";
    END IF;

    IF off_school_id <> NEW."schoolId" THEN
      RAISE EXCEPTION 'Cross-school teacher assignment: offering school % does not match assignment school %', off_school_id, NEW."schoolId";
    END IF;

    IF off_year_id <> NEW."academicYearId" THEN
      RAISE EXCEPTION 'Cross-year teacher assignment: offering academic year % does not match assignment academic year %', off_year_id, NEW."academicYearId";
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_validate_teacher_assignment_context ON "teacher_assignments";
CREATE TRIGGER trg_validate_teacher_assignment_context
  BEFORE INSERT OR UPDATE ON "teacher_assignments"
  FOR EACH ROW
  EXECUTE FUNCTION fn_validate_teacher_assignment_context();
