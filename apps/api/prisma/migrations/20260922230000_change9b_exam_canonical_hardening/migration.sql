-- ============================================================
-- Migration: 20260922230000_change9b_exam_canonical_hardening
-- Change #9B: Examination Canonical Academic Context Hardening
--
-- 1. Adds schoolSubjectOfferingId column to exam_subjects
-- 2. Creates foreign key constraint to school_subject_offerings
-- 3. Adds supporting indexes for query performance and integrity
-- 4. Allows subjectId to be nullable for future pure canonical offerings
-- 5. Creates partial unique indexes for canonical offering and legacy subject
-- 6. Implements database trigger fn_validate_exam_subject_context
-- 7. Implements database trigger fn_validate_student_mark_context
-- ============================================================

-- 1. Add canonical offering column to exam_subjects
ALTER TABLE "exam_subjects"
  ADD COLUMN IF NOT EXISTS "schoolSubjectOfferingId" TEXT;

-- 2. Foreign key to school_subject_offerings
DO $$ BEGIN
  ALTER TABLE "exam_subjects"
    ADD CONSTRAINT "exam_subjects_schoolSubjectOfferingId_fkey"
    FOREIGN KEY ("schoolSubjectOfferingId") REFERENCES "school_subject_offerings"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- 3. Supporting indexes
CREATE INDEX IF NOT EXISTS "exam_subjects_schoolSubjectOfferingId_idx"
  ON "exam_subjects"("schoolSubjectOfferingId");

CREATE INDEX IF NOT EXISTS "exam_subjects_examId_classId_idx"
  ON "exam_subjects"("examId", "classId");

-- 4. Make subjectId nullable for forward compatibility with pure canonical offerings
ALTER TABLE "exam_subjects"
  ALTER COLUMN "subjectId" DROP NOT NULL;

-- 5. Partial unique indexes for exam subject identity
CREATE UNIQUE INDEX IF NOT EXISTS "exam_subjects_exam_offering_class_key"
  ON "exam_subjects"("examId", "schoolSubjectOfferingId", "classId")
  WHERE "schoolSubjectOfferingId" IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "exam_subjects_exam_subject_class_key"
  ON "exam_subjects"("examId", "subjectId", "classId")
  WHERE "subjectId" IS NOT NULL;

-- 6. Database Trigger: fn_validate_exam_subject_context
CREATE OR REPLACE FUNCTION fn_validate_exam_subject_context()
RETURNS TRIGGER AS $$
DECLARE
  exam_school_id TEXT;
  exam_year_id TEXT;
  ay_locked BOOLEAN;
  ay_school_id TEXT;
  cls_school_id TEXT;
  cls_year_id TEXT;
  cls_numeric_level INT;
  off_school_id TEXT;
  off_year_id TEXT;
  off_grade_from INT;
  off_grade_to INT;
  off_legacy_subj_id TEXT;
  off_is_offered BOOLEAN;
  sub_school_id TEXT;
BEGIN
  -- 1. Validate Exam exists and resolve schoolId + academicYearId
  SELECT e."schoolId", e."academicYearId"
  INTO exam_school_id, exam_year_id
  FROM "exams" e
  WHERE e."id" = NEW."examId";

  IF exam_school_id IS NULL THEN
    RAISE EXCEPTION 'ExamSubject references invalid or non-existent exam %', NEW."examId";
  END IF;

  -- 2. Validate Academic Year exists, belongs to school, and is not locked
  SELECT ay."schoolId", ay."isLocked"
  INTO ay_school_id, ay_locked
  FROM "academic_years" ay
  WHERE ay."id" = exam_year_id;

  IF ay_school_id IS NULL THEN
    RAISE EXCEPTION 'Exam references invalid or non-existent academic year %', exam_year_id;
  END IF;

  IF ay_school_id <> exam_school_id THEN
    RAISE EXCEPTION 'Cross-school exam academic year: school % does not match academic year school %', exam_school_id, ay_school_id;
  END IF;

  IF ay_locked IS TRUE THEN
    RAISE EXCEPTION 'Academic session % is locked. Structural changes are not permitted.', exam_year_id;
  END IF;

  -- 3. Validate Class belongs to exam school and exam academic year
  SELECT c."schoolId", c."academicYearId", c."numericLevel"
  INTO cls_school_id, cls_year_id, cls_numeric_level
  FROM "classes" c
  WHERE c."id" = NEW."classId";

  IF cls_school_id IS NULL THEN
    RAISE EXCEPTION 'ExamSubject references invalid or non-existent class %', NEW."classId";
  END IF;

  IF cls_school_id <> exam_school_id THEN
    RAISE EXCEPTION 'Cross-school exam subject class: class school % does not match exam school %', cls_school_id, exam_school_id;
  END IF;

  IF cls_year_id <> exam_year_id THEN
    RAISE EXCEPTION 'Cross-year exam subject class: class academic year % does not match exam academic year %', cls_year_id, exam_year_id;
  END IF;

  -- 4. Validate Canonical Offering (if supplied)
  IF NEW."schoolSubjectOfferingId" IS NOT NULL THEN
    SELECT off."schoolId", off."academicYearId", off."gradeFrom", off."gradeTo", off."legacySubjectId", off."isOffered"
    INTO off_school_id, off_year_id, off_grade_from, off_grade_to, off_legacy_subj_id, off_is_offered
    FROM "school_subject_offerings" off
    WHERE off."id" = NEW."schoolSubjectOfferingId";

    IF off_school_id IS NULL THEN
      RAISE EXCEPTION 'ExamSubject references invalid or non-existent offering %', NEW."schoolSubjectOfferingId";
    END IF;

    IF off_school_id <> exam_school_id THEN
      RAISE EXCEPTION 'Cross-school exam subject offering: offering school % does not match exam school %', off_school_id, exam_school_id;
    END IF;

    IF off_year_id <> exam_year_id THEN
      RAISE EXCEPTION 'Cross-year exam subject offering: offering academic year % does not match exam academic year %', off_year_id, exam_year_id;
    END IF;

    IF cls_numeric_level < off_grade_from OR cls_numeric_level > off_grade_to THEN
      RAISE EXCEPTION 'Offering % (grades %-%) is not compatible with class numeric level %', NEW."schoolSubjectOfferingId", off_grade_from, off_grade_to, cls_numeric_level;
    END IF;

    -- Inactive offering check on INSERT or when offering changes on UPDATE
    IF (TG_OP = 'INSERT') OR (TG_OP = 'UPDATE' AND (OLD."schoolSubjectOfferingId" IS NULL OR NEW."schoolSubjectOfferingId" <> OLD."schoolSubjectOfferingId")) THEN
      IF off_is_offered IS FALSE THEN
        RAISE EXCEPTION 'School subject offering % is inactive and cannot be selected for exam subjects', NEW."schoolSubjectOfferingId";
      END IF;
    END IF;

    IF NEW."subjectId" IS NOT NULL AND off_legacy_subj_id IS NOT NULL AND NEW."subjectId" <> off_legacy_subj_id THEN
      RAISE EXCEPTION 'ExamSubject subjectId % contradicts canonical offering legacySubjectId %', NEW."subjectId", off_legacy_subj_id;
    END IF;
  END IF;

  -- 5. Validate Legacy Subject (if supplied)
  IF NEW."subjectId" IS NOT NULL THEN
    SELECT s."schoolId"
    INTO sub_school_id
    FROM "subjects" s
    WHERE s."id" = NEW."subjectId";

    IF sub_school_id IS NULL THEN
      RAISE EXCEPTION 'ExamSubject references invalid or non-existent subject %', NEW."subjectId";
    END IF;

    IF sub_school_id <> exam_school_id THEN
      RAISE EXCEPTION 'Cross-school exam subject: subject school % does not match exam school %', sub_school_id, exam_school_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_validate_exam_subject_context ON "exam_subjects";
CREATE TRIGGER trg_validate_exam_subject_context
BEFORE INSERT OR UPDATE ON "exam_subjects"
FOR EACH ROW
EXECUTE FUNCTION fn_validate_exam_subject_context();

-- 7. Database Trigger: fn_validate_student_mark_context
CREATE OR REPLACE FUNCTION fn_validate_student_mark_context()
RETURNS TRIGGER AS $$
DECLARE
  es_class_id TEXT;
  exam_school_id TEXT;
  exam_year_id TEXT;
  stud_school_id TEXT;
  enr_id TEXT;
BEGIN
  -- 1. Resolve ExamSubject -> Exam context
  SELECT es."classId", e."schoolId", e."academicYearId"
  INTO es_class_id, exam_school_id, exam_year_id
  FROM "exam_subjects" es
  JOIN "exams" e ON e."id" = es."examId"
  WHERE es."id" = NEW."examSubjectId";

  IF es_class_id IS NULL THEN
    RAISE EXCEPTION 'StudentMark references invalid or non-existent exam subject %', NEW."examSubjectId";
  END IF;

  -- 2. Validate Student belongs to same school
  SELECT s."schoolId"
  INTO stud_school_id
  FROM "students" s
  WHERE s."id" = NEW."studentId";

  IF stud_school_id IS NULL THEN
    RAISE EXCEPTION 'StudentMark references invalid or non-existent student %', NEW."studentId";
  END IF;

  IF stud_school_id <> exam_school_id THEN
    RAISE EXCEPTION 'Cross-school student mark: student school % does not match exam school %', stud_school_id, exam_school_id;
  END IF;

  -- 3. Validate Student has an enrollment in the exam academic year and exam subject class
  SELECT se."id"
  INTO enr_id
  FROM "student_enrollments" se
  JOIN "sections" sec ON sec."id" = se."sectionId"
  WHERE se."studentId" = NEW."studentId"
    AND se."academicYearId" = exam_year_id
    AND sec."classId" = es_class_id
  LIMIT 1;

  IF enr_id IS NULL THEN
    RAISE EXCEPTION 'Student % does not have an enrollment in class % for exam academic year %', NEW."studentId", es_class_id, exam_year_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_validate_student_mark_context ON "student_marks";
CREATE TRIGGER trg_validate_student_mark_context
BEFORE INSERT OR UPDATE ON "student_marks"
FOR EACH ROW
EXECUTE FUNCTION fn_validate_student_mark_context();
