-- ============================================================
-- Migration: 20260922193000_change9a_assignment_canonical_hardening
-- Change #9A: Assignments Canonical Academic Context Hardening
--
-- 1. Adds schoolSubjectOfferingId column to assignments
-- 2. Creates foreign key constraint to school_subject_offerings
-- 3. Adds supporting indexes for query performance and integrity
-- 4. Allows subjectId to be nullable for future pure canonical offerings
-- 5. Implements database trigger fn_validate_assignment_context
--    enforcing server-authoritative context invariants:
--    - Assignment.schoolId == AcademicYear.schoolId
--    - AcademicYear.isLocked IS FALSE
--    - Class.schoolId == Assignment.schoolId
--    - Class.academicYearId == Assignment.academicYearId
--    - Section.classId == Assignment.classId
--    - Section.class.schoolId == Assignment.schoolId
--    - Section.class.academicYearId == Assignment.academicYearId
--    - Staff.schoolId == Assignment.schoolId
--    - SchoolSubjectOffering.schoolId == Assignment.schoolId
--    - SchoolSubjectOffering.academicYearId == Assignment.academicYearId
--    - Class.numericLevel BETWEEN Offering.gradeFrom AND Offering.gradeTo
--    - Offering.legacySubjectId == Assignment.subjectId (no contradiction)
--    - Subject.schoolId == Assignment.schoolId
-- ============================================================

-- 1. Add canonical offering column
ALTER TABLE "assignments"
  ADD COLUMN IF NOT EXISTS "schoolSubjectOfferingId" TEXT;

-- 2. Foreign key to school_subject_offerings
DO $$ BEGIN
  ALTER TABLE "assignments"
    ADD CONSTRAINT "assignments_schoolSubjectOfferingId_fkey"
    FOREIGN KEY ("schoolSubjectOfferingId") REFERENCES "school_subject_offerings"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- 3. Supporting indexes
CREATE INDEX IF NOT EXISTS "assignments_schoolSubjectOfferingId_idx"
  ON "assignments"("schoolSubjectOfferingId");

CREATE INDEX IF NOT EXISTS "assignments_schoolId_academicYearId_idx"
  ON "assignments"("schoolId", "academicYearId");

CREATE INDEX IF NOT EXISTS "assignments_schoolId_schoolSubjectOfferingId_idx"
  ON "assignments"("schoolId", "schoolSubjectOfferingId");

-- 4. Make subjectId nullable for forward compatibility with pure canonical offerings
ALTER TABLE "assignments"
  ALTER COLUMN "subjectId" DROP NOT NULL;

-- 5. Database Trigger: fn_validate_assignment_context
CREATE OR REPLACE FUNCTION fn_validate_assignment_context()
RETURNS TRIGGER AS $$
DECLARE
  cls_school_id TEXT;
  cls_year_id TEXT;
  cls_numeric_level INT;
  sec_class_id TEXT;
  sec_school_id TEXT;
  sec_year_id TEXT;
  stf_school_id TEXT;
  ay_locked BOOLEAN;
  ay_school_id TEXT;
  off_school_id TEXT;
  off_year_id TEXT;
  off_grade_from INT;
  off_grade_to INT;
  off_legacy_subj_id TEXT;
  sub_school_id TEXT;
BEGIN
  -- 1. Validate Academic Year exists, belongs to school, and is not locked
  SELECT ay."schoolId", ay."isLocked"
  INTO ay_school_id, ay_locked
  FROM "academic_years" ay
  WHERE ay."id" = NEW."academicYearId";

  IF ay_school_id IS NULL THEN
    RAISE EXCEPTION 'Assignment references invalid or non-existent academic year %', NEW."academicYearId";
  END IF;

  IF ay_school_id <> NEW."schoolId" THEN
    RAISE EXCEPTION 'Cross-school assignment academic year: school % does not match academic year school %', NEW."schoolId", ay_school_id;
  END IF;

  IF ay_locked IS TRUE THEN
    RAISE EXCEPTION 'Academic session % is locked. Structural changes are not permitted.', NEW."academicYearId";
  END IF;

  -- 2. Validate Class belongs to school and academic year
  SELECT c."schoolId", c."academicYearId", c."numericLevel"
  INTO cls_school_id, cls_year_id, cls_numeric_level
  FROM "classes" c
  WHERE c."id" = NEW."classId";

  IF cls_school_id IS NULL THEN
    RAISE EXCEPTION 'Assignment references invalid or non-existent class %', NEW."classId";
  END IF;

  IF cls_school_id <> NEW."schoolId" THEN
    RAISE EXCEPTION 'Cross-school assignment class: class school % does not match assignment school %', cls_school_id, NEW."schoolId";
  END IF;

  IF cls_year_id <> NEW."academicYearId" THEN
    RAISE EXCEPTION 'Cross-year assignment class: class academic year % does not match assignment academic year %', cls_year_id, NEW."academicYearId";
  END IF;

  -- 3. Validate Section (if supplied)
  IF NEW."sectionId" IS NOT NULL THEN
    SELECT s."classId", c."schoolId", c."academicYearId"
    INTO sec_class_id, sec_school_id, sec_year_id
    FROM "sections" s
    JOIN "classes" c ON c."id" = s."classId"
    WHERE s."id" = NEW."sectionId";

    IF sec_class_id IS NULL THEN
      RAISE EXCEPTION 'Assignment references invalid or non-existent section %', NEW."sectionId";
    END IF;

    IF sec_class_id <> NEW."classId" THEN
      RAISE EXCEPTION 'Section % does not belong to assignment class %', NEW."sectionId", NEW."classId";
    END IF;

    IF sec_school_id <> NEW."schoolId" THEN
      RAISE EXCEPTION 'Section % belongs to different school % than assignment %', NEW."sectionId", sec_school_id, NEW."schoolId";
    END IF;

    IF sec_year_id <> NEW."academicYearId" THEN
      RAISE EXCEPTION 'Section % belongs to different academic year % than assignment %', NEW."sectionId", sec_year_id, NEW."academicYearId";
    END IF;
  END IF;

  -- 4. Validate Staff belongs to school
  SELECT st."schoolId"
  INTO stf_school_id
  FROM "staff" st
  WHERE st."id" = NEW."staffId";

  IF stf_school_id IS NULL THEN
    RAISE EXCEPTION 'Assignment references invalid or non-existent staff %', NEW."staffId";
  END IF;

  IF stf_school_id <> NEW."schoolId" THEN
    RAISE EXCEPTION 'Cross-school assignment staff: staff school % does not match assignment school %', stf_school_id, NEW."schoolId";
  END IF;

  -- 5. Validate Canonical Offering (if supplied)
  IF NEW."schoolSubjectOfferingId" IS NOT NULL THEN
    SELECT off."schoolId", off."academicYearId", off."gradeFrom", off."gradeTo", off."legacySubjectId"
    INTO off_school_id, off_year_id, off_grade_from, off_grade_to, off_legacy_subj_id
    FROM "school_subject_offerings" off
    WHERE off."id" = NEW."schoolSubjectOfferingId";

    IF off_school_id IS NULL THEN
      RAISE EXCEPTION 'Assignment references invalid or non-existent offering %', NEW."schoolSubjectOfferingId";
    END IF;

    IF off_school_id <> NEW."schoolId" THEN
      RAISE EXCEPTION 'Cross-school assignment offering: offering school % does not match assignment school %', off_school_id, NEW."schoolId";
    END IF;

    IF off_year_id <> NEW."academicYearId" THEN
      RAISE EXCEPTION 'Cross-year assignment offering: offering academic year % does not match assignment academic year %', off_year_id, NEW."academicYearId";
    END IF;

    IF cls_numeric_level < off_grade_from OR cls_numeric_level > off_grade_to THEN
      RAISE EXCEPTION 'Offering % (grades %-%) is not compatible with class numeric level %', NEW."schoolSubjectOfferingId", off_grade_from, off_grade_to, cls_numeric_level;
    END IF;

    IF NEW."subjectId" IS NOT NULL AND off_legacy_subj_id IS NOT NULL AND NEW."subjectId" <> off_legacy_subj_id THEN
      RAISE EXCEPTION 'Assignment subjectId % contradicts canonical offering legacySubjectId %', NEW."subjectId", off_legacy_subj_id;
    END IF;
  END IF;

  -- 6. Validate Legacy Subject (if supplied)
  IF NEW."subjectId" IS NOT NULL THEN
    SELECT s."schoolId"
    INTO sub_school_id
    FROM "subjects" s
    WHERE s."id" = NEW."subjectId";

    IF sub_school_id IS NULL THEN
      RAISE EXCEPTION 'Assignment references invalid or non-existent subject %', NEW."subjectId";
    END IF;

    IF sub_school_id <> NEW."schoolId" THEN
      RAISE EXCEPTION 'Cross-school assignment subject: subject school % does not match assignment school %', sub_school_id, NEW."schoolId";
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_validate_assignment_context ON "assignments";
CREATE TRIGGER trg_validate_assignment_context
BEFORE INSERT OR UPDATE ON "assignments"
FOR EACH ROW
EXECUTE FUNCTION fn_validate_assignment_context();
