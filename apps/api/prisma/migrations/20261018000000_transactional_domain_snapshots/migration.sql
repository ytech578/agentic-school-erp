CREATE TABLE "domain_audit_events" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "schoolId" TEXT,
  "actorId" TEXT,
  "databaseRole" TEXT NOT NULL,
  "tableName" TEXT NOT NULL,
  "operation" TEXT NOT NULL,
  "resourceId" TEXT,
  "before" JSONB,
  "after" JSONB,
  "transactionId" BIGINT NOT NULL DEFAULT txid_current(),
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "domain_audit_events_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "domain_audit_events_schoolId_createdAt_idx" ON "domain_audit_events"("schoolId", "createdAt");
CREATE INDEX "domain_audit_events_tableName_resourceId_idx" ON "domain_audit_events"("tableName", "resourceId");

CREATE OR REPLACE FUNCTION app_security.redact_audit_snapshot(value JSONB)
RETURNS JSONB LANGUAGE plpgsql IMMUTABLE SET search_path = pg_catalog AS $$
DECLARE result JSONB; item RECORD;
BEGIN
  IF value IS NULL THEN RETURN NULL; END IF;
  IF jsonb_typeof(value) = 'object' THEN
    result := '{}'::jsonb;
    FOR item IN SELECT key, val FROM jsonb_each(value) AS entry(key, val) LOOP
      result := result || jsonb_build_object(item.key,
        CASE WHEN item.key ~* '(password|secret|token|recovery.?codes|otpauth|qrCodeDataUrl)'
          THEN '"[REDACTED]"'::jsonb ELSE app_security.redact_audit_snapshot(item.val) END);
    END LOOP;
    RETURN result;
  ELSIF jsonb_typeof(value) = 'array' THEN
    SELECT COALESCE(jsonb_agg(app_security.redact_audit_snapshot(element)), '[]'::jsonb)
      INTO result FROM jsonb_array_elements(value) AS elements(element);
    RETURN result;
  END IF;
  RETURN value;
END $$;

CREATE OR REPLACE FUNCTION app_security.capture_domain_snapshot()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public, app_security AS $$
DECLARE
  previous_state JSONB;
  next_state JSONB;
  row_state JSONB;
  tenant_id TEXT;
  parent_table TEXT;
  parent_key TEXT;
BEGIN
  IF TG_OP <> 'INSERT' THEN previous_state := to_jsonb(OLD); END IF;
  IF TG_OP <> 'DELETE' THEN next_state := to_jsonb(NEW); END IF;
  row_state := COALESCE(next_state, previous_state);
  tenant_id := row_state->>'schoolId';
  IF TG_TABLE_NAME = 'schools' THEN tenant_id := row_state->>'id'; END IF;
  IF tenant_id IS NULL THEN
    SELECT mapping.parent_name, mapping.key_name INTO parent_table, parent_key
    FROM (VALUES
      ('user_sessions', 'users', 'userId'),
      ('student_documents', 'students', 'studentId'),
      ('admission_documents', 'admission_applications', 'applicationId'),
      ('external_identities', 'identity_providers', 'providerId'),
      ('sections', 'classes', 'classId'),
      ('class_subjects', 'classes', 'classId'),
      ('student_subject_enrollments', 'students', 'studentId'),
      ('guardians', 'students', 'studentId'),
      ('student_enrollments', 'students', 'studentId'),
      ('fee_structure_items', 'fee_structures', 'feeStructureId'),
      ('fee_payment_items', 'fee_payments', 'feePaymentId'),
      ('receipts', 'fee_payments', 'feePaymentId'),
      ('exam_subjects', 'exams', 'examId'),
      ('student_marks', 'students', 'studentId'),
      ('report_cards', 'students', 'studentId'),
      ('assignment_submissions', 'assignments', 'assignmentId'),
      ('ai_messages', 'ai_conversations', 'conversationId')
    ) AS mapping(child_name, parent_name, key_name)
    WHERE mapping.child_name = TG_TABLE_NAME;
    IF parent_table IS NOT NULL AND row_state->>parent_key IS NOT NULL THEN
      EXECUTE format('SELECT "schoolId" FROM public.%I WHERE "id" = $1', parent_table)
        INTO tenant_id USING row_state->>parent_key;
    END IF;
  END IF;
  tenant_id := COALESCE(tenant_id, NULLIF(current_setting('app.current_school_id', true), ''));
  INSERT INTO public.domain_audit_events
    ("schoolId", "actorId", "databaseRole", "tableName", "operation", "resourceId", "before", "after")
  VALUES (tenant_id, NULLIF(current_setting('app.current_user_id', true), ''),
    session_user, TG_TABLE_NAME, TG_OP, row_state->>'id',
    app_security.redact_audit_snapshot(previous_state), app_security.redact_audit_snapshot(next_state));
  RETURN NULL;
END $$;

CREATE OR REPLACE FUNCTION app_security.protect_domain_audit()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = pg_catalog AS $$
BEGIN
  RAISE EXCEPTION 'Domain audit events are append-only' USING ERRCODE = '42501';
END $$;
CREATE TRIGGER protect_domain_audit BEFORE UPDATE OR DELETE OR TRUNCATE
  ON "domain_audit_events" FOR EACH STATEMENT EXECUTE FUNCTION app_security.protect_domain_audit();

DO $$
DECLARE target RECORD;
BEGIN
  FOR target IN SELECT tablename FROM pg_tables WHERE schemaname = 'public'
    AND tablename NOT IN ('_prisma_migrations', 'activity_logs', 'domain_audit_events')
  LOOP
    EXECUTE format('CREATE TRIGGER domain_snapshot AFTER INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION app_security.capture_domain_snapshot()', target.tablename);
  END LOOP;
END $$;

ALTER TABLE "domain_audit_events" ENABLE ROW LEVEL SECURITY;
CREATE POLICY audit_tenant_read ON "domain_audit_events" FOR SELECT
  USING (app_security.has_tenant_access("schoolId"));
REVOKE ALL ON FUNCTION app_security.capture_domain_snapshot() FROM PUBLIC;
REVOKE ALL ON FUNCTION app_security.protect_domain_audit() FROM PUBLIC;
