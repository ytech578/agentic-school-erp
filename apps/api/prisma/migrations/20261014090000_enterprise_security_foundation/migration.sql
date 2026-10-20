-- Enterprise security foundation: federation, MFA/session governance,
-- break-glass approvals, tamper-evident audit metadata, document quarantine,
-- and PostgreSQL tenant row-level security.

CREATE TYPE "AuthMethod" AS ENUM ('PASSWORD', 'OIDC', 'SAML', 'BREAK_GLASS');
CREATE TYPE "IdentityProviderType" AS ENUM ('OIDC', 'SAML');
CREATE TYPE "BreakGlassStatus" AS ENUM ('PENDING', 'ACTIVE', 'REVOKED', 'EXPIRED');
CREATE TYPE "DocumentScanStatus" AS ENUM ('PENDING', 'CLEAN', 'INFECTED', 'ERROR', 'QUARANTINED');

ALTER TABLE "users"
  ADD COLUMN "scimExternalId" TEXT,
  ADD COLUMN "mfaRecoveryCodes" JSONB,
  ADD COLUMN "mfaEnrolledAt" TIMESTAMP(3),
  ADD COLUMN "mfaLastVerifiedAt" TIMESTAMP(3);

CREATE UNIQUE INDEX "users_schoolId_scimExternalId_key"
  ON "users"("schoolId", "scimExternalId");

ALTER TABLE "user_sessions"
  ADD COLUMN "authMethod" "AuthMethod" NOT NULL DEFAULT 'PASSWORD',
  ADD COLUMN "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN "mfaVerifiedAt" TIMESTAMP(3),
  ADD COLUMN "revokedAt" TIMESTAMP(3),
  ADD COLUMN "revokedById" TEXT,
  ADD COLUMN "revokeReason" TEXT;

ALTER TABLE "activity_logs"
  ADD COLUMN "requestId" TEXT,
  ADD COLUMN "correlationId" TEXT,
  ADD COLUMN "previousHash" TEXT,
  ADD COLUMN "integrityHash" TEXT;

CREATE INDEX "activity_logs_requestId_idx" ON "activity_logs"("requestId");

CREATE TABLE "identity_providers" (
  "id" TEXT NOT NULL,
  "schoolId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "type" "IdentityProviderType" NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT false,
  "issuer" TEXT,
  "clientId" TEXT,
  "clientSecretEncrypted" TEXT,
  "authorizationUrl" TEXT,
  "tokenUrl" TEXT,
  "userInfoUrl" TEXT,
  "jwksUri" TEXT,
  "samlEntityId" TEXT,
  "samlSsoUrl" TEXT,
  "samlCertificate" TEXT,
  "allowedDomains" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "defaultRole" "UserRole" NOT NULL DEFAULT 'TEACHER',
  "jitProvisioning" BOOLEAN NOT NULL DEFAULT false,
  "enforceSso" BOOLEAN NOT NULL DEFAULT false,
  "config" JSONB DEFAULT '{}',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "identity_providers_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "external_identities" (
  "id" TEXT NOT NULL,
  "providerId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "subject" TEXT NOT NULL,
  "email" TEXT,
  "claims" JSONB,
  "lastLoginAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "external_identities_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "scim_access_tokens" (
  "id" TEXT NOT NULL,
  "schoolId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "scopes" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "expiresAt" TIMESTAMP(3),
  "lastUsedAt" TIMESTAMP(3),
  "createdById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "revokedAt" TIMESTAMP(3),
  CONSTRAINT "scim_access_tokens_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "break_glass_grants" (
  "id" TEXT NOT NULL,
  "schoolId" TEXT NOT NULL,
  "requesterId" TEXT NOT NULL,
  "approverId" TEXT,
  "reason" TEXT NOT NULL,
  "status" "BreakGlassStatus" NOT NULL DEFAULT 'PENDING',
  "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "approvedAt" TIMESTAMP(3),
  "expiresAt" TIMESTAMP(3),
  "lastUsedAt" TIMESTAMP(3),
  "revokedAt" TIMESTAMP(3),
  "revokeReason" TEXT,
  CONSTRAINT "break_glass_grants_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "identity_providers_schoolId_slug_key" ON "identity_providers"("schoolId", "slug");
CREATE INDEX "identity_providers_schoolId_enabled_idx" ON "identity_providers"("schoolId", "enabled");
CREATE UNIQUE INDEX "external_identities_providerId_subject_key" ON "external_identities"("providerId", "subject");
CREATE UNIQUE INDEX "external_identities_providerId_userId_key" ON "external_identities"("providerId", "userId");
CREATE INDEX "external_identities_userId_idx" ON "external_identities"("userId");
CREATE UNIQUE INDEX "scim_access_tokens_tokenHash_key" ON "scim_access_tokens"("tokenHash");
CREATE INDEX "scim_access_tokens_schoolId_isActive_idx" ON "scim_access_tokens"("schoolId", "isActive");
CREATE INDEX "break_glass_grants_requesterId_schoolId_status_expiresAt_idx" ON "break_glass_grants"("requesterId", "schoolId", "status", "expiresAt");
CREATE INDEX "break_glass_grants_schoolId_status_idx" ON "break_glass_grants"("schoolId", "status");

ALTER TABLE "identity_providers" ADD CONSTRAINT "identity_providers_schoolId_fkey"
  FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "external_identities" ADD CONSTRAINT "external_identities_providerId_fkey"
  FOREIGN KEY ("providerId") REFERENCES "identity_providers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "external_identities" ADD CONSTRAINT "external_identities_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "scim_access_tokens" ADD CONSTRAINT "scim_access_tokens_schoolId_fkey"
  FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "break_glass_grants" ADD CONSTRAINT "break_glass_grants_schoolId_fkey"
  FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "break_glass_grants" ADD CONSTRAINT "break_glass_grants_requesterId_fkey"
  FOREIGN KEY ("requesterId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "break_glass_grants" ADD CONSTRAINT "break_glass_grants_approverId_fkey"
  FOREIGN KEY ("approverId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "student_documents"
  ADD COLUMN "sha256" TEXT,
  ADD COLUMN "scanStatus" "DocumentScanStatus" NOT NULL DEFAULT 'PENDING',
  ADD COLUMN "scanEngine" TEXT,
  ADD COLUMN "scanResult" JSONB,
  ADD COLUMN "scannedAt" TIMESTAMP(3),
  ADD COLUMN "quarantineReason" TEXT,
  ADD COLUMN "retainedUntil" TIMESTAMP(3),
  ADD COLUMN "legalHold" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "deletedAt" TIMESTAMP(3);

ALTER TABLE "admission_documents"
  ADD COLUMN "fileName" TEXT,
  ADD COLUMN "fileSize" INTEGER,
  ADD COLUMN "mimeType" TEXT,
  ADD COLUMN "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN "sha256" TEXT,
  ADD COLUMN "scanStatus" "DocumentScanStatus" NOT NULL DEFAULT 'PENDING',
  ADD COLUMN "scanEngine" TEXT,
  ADD COLUMN "scanResult" JSONB,
  ADD COLUMN "scannedAt" TIMESTAMP(3),
  ADD COLUMN "quarantineReason" TEXT,
  ADD COLUMN "retainedUntil" TIMESTAMP(3),
  ADD COLUMN "legalHold" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "deletedAt" TIMESTAMP(3);

CREATE INDEX "student_documents_scanStatus_uploadedAt_idx" ON "student_documents"("scanStatus", "uploadedAt");
CREATE INDEX "student_documents_retainedUntil_deletedAt_idx" ON "student_documents"("retainedUntil", "deletedAt");
CREATE INDEX "admission_documents_scanStatus_uploadedAt_idx" ON "admission_documents"("scanStatus", "uploadedAt");
CREATE INDEX "admission_documents_retainedUntil_deletedAt_idx" ON "admission_documents"("retainedUntil", "deletedAt");

CREATE SCHEMA IF NOT EXISTS app_security;
REVOKE ALL ON SCHEMA app_security FROM PUBLIC;
GRANT USAGE ON SCHEMA app_security TO PUBLIC;

CREATE OR REPLACE FUNCTION app_security.has_tenant_access(row_school_id TEXT)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
AS $$
  SELECT
    current_setting('app.bypass_rls', true) = 'on'
    OR current_setting('app.is_platform_admin', true) = 'on'
    OR row_school_id = NULLIF(current_setting('app.current_school_id', true), '');
$$;

-- Apply a uniform policy to every tenant-owned table with a schoolId column.
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

ALTER TABLE "schools" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "schools"
  USING (app_security.has_tenant_access("id"))
  WITH CHECK (app_security.has_tenant_access("id"));

ALTER TABLE "user_sessions" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "user_sessions"
  USING (
    current_setting('app.bypass_rls', true) = 'on'
    OR current_setting('app.is_platform_admin', true) = 'on'
    OR EXISTS (SELECT 1 FROM "users" u WHERE u."id" = "user_sessions"."userId" AND app_security.has_tenant_access(u."schoolId"))
  )
  WITH CHECK (
    current_setting('app.bypass_rls', true) = 'on'
    OR current_setting('app.is_platform_admin', true) = 'on'
    OR EXISTS (SELECT 1 FROM "users" u WHERE u."id" = "user_sessions"."userId" AND app_security.has_tenant_access(u."schoolId"))
  );

ALTER TABLE "student_documents" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "student_documents"
  USING (EXISTS (SELECT 1 FROM "students" s WHERE s."id" = "student_documents"."studentId" AND app_security.has_tenant_access(s."schoolId")))
  WITH CHECK (EXISTS (SELECT 1 FROM "students" s WHERE s."id" = "student_documents"."studentId" AND app_security.has_tenant_access(s."schoolId")));

ALTER TABLE "admission_documents" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "admission_documents"
  USING (EXISTS (SELECT 1 FROM "admission_applications" a WHERE a."id" = "admission_documents"."applicationId" AND app_security.has_tenant_access(a."schoolId")))
  WITH CHECK (EXISTS (SELECT 1 FROM "admission_applications" a WHERE a."id" = "admission_documents"."applicationId" AND app_security.has_tenant_access(a."schoolId")));

ALTER TABLE "external_identities" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "external_identities"
  USING (EXISTS (SELECT 1 FROM "identity_providers" p WHERE p."id" = "external_identities"."providerId" AND app_security.has_tenant_access(p."schoolId")))
  WITH CHECK (EXISTS (SELECT 1 FROM "identity_providers" p WHERE p."id" = "external_identities"."providerId" AND app_security.has_tenant_access(p."schoolId")));

-- Child tables that inherit their tenant through a parent foreign key need
-- explicit policies because they intentionally do not duplicate schoolId.
ALTER TABLE "sections" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "sections"
  USING (EXISTS (SELECT 1 FROM "classes" p WHERE p."id" = "sections"."classId" AND app_security.has_tenant_access(p."schoolId")))
  WITH CHECK (EXISTS (SELECT 1 FROM "classes" p WHERE p."id" = "sections"."classId" AND app_security.has_tenant_access(p."schoolId")));

ALTER TABLE "class_subjects" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "class_subjects"
  USING (EXISTS (SELECT 1 FROM "classes" p WHERE p."id" = "class_subjects"."classId" AND app_security.has_tenant_access(p."schoolId")))
  WITH CHECK (EXISTS (SELECT 1 FROM "classes" p WHERE p."id" = "class_subjects"."classId" AND app_security.has_tenant_access(p."schoolId")));

ALTER TABLE "student_subject_enrollments" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "student_subject_enrollments"
  USING (EXISTS (SELECT 1 FROM "students" p WHERE p."id" = "student_subject_enrollments"."studentId" AND app_security.has_tenant_access(p."schoolId")))
  WITH CHECK (EXISTS (SELECT 1 FROM "students" p WHERE p."id" = "student_subject_enrollments"."studentId" AND app_security.has_tenant_access(p."schoolId")));

ALTER TABLE "guardians" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "guardians"
  USING (EXISTS (SELECT 1 FROM "students" p WHERE p."id" = "guardians"."studentId" AND app_security.has_tenant_access(p."schoolId")))
  WITH CHECK (EXISTS (SELECT 1 FROM "students" p WHERE p."id" = "guardians"."studentId" AND app_security.has_tenant_access(p."schoolId")));

ALTER TABLE "student_enrollments" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "student_enrollments"
  USING (EXISTS (SELECT 1 FROM "students" p WHERE p."id" = "student_enrollments"."studentId" AND app_security.has_tenant_access(p."schoolId")))
  WITH CHECK (EXISTS (SELECT 1 FROM "students" p WHERE p."id" = "student_enrollments"."studentId" AND app_security.has_tenant_access(p."schoolId")));

ALTER TABLE "fee_structure_items" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "fee_structure_items"
  USING (EXISTS (SELECT 1 FROM "fee_structures" p WHERE p."id" = "fee_structure_items"."feeStructureId" AND app_security.has_tenant_access(p."schoolId")))
  WITH CHECK (EXISTS (SELECT 1 FROM "fee_structures" p WHERE p."id" = "fee_structure_items"."feeStructureId" AND app_security.has_tenant_access(p."schoolId")));

ALTER TABLE "fee_payment_items" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "fee_payment_items"
  USING (EXISTS (SELECT 1 FROM "fee_payments" p WHERE p."id" = "fee_payment_items"."feePaymentId" AND app_security.has_tenant_access(p."schoolId")))
  WITH CHECK (EXISTS (SELECT 1 FROM "fee_payments" p WHERE p."id" = "fee_payment_items"."feePaymentId" AND app_security.has_tenant_access(p."schoolId")));

ALTER TABLE "receipts" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "receipts"
  USING (EXISTS (SELECT 1 FROM "fee_payments" p WHERE p."id" = "receipts"."feePaymentId" AND app_security.has_tenant_access(p."schoolId")))
  WITH CHECK (EXISTS (SELECT 1 FROM "fee_payments" p WHERE p."id" = "receipts"."feePaymentId" AND app_security.has_tenant_access(p."schoolId")));

ALTER TABLE "exam_subjects" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "exam_subjects"
  USING (EXISTS (SELECT 1 FROM "exams" p WHERE p."id" = "exam_subjects"."examId" AND app_security.has_tenant_access(p."schoolId")))
  WITH CHECK (EXISTS (SELECT 1 FROM "exams" p WHERE p."id" = "exam_subjects"."examId" AND app_security.has_tenant_access(p."schoolId")));

ALTER TABLE "student_marks" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "student_marks"
  USING (EXISTS (SELECT 1 FROM "students" p WHERE p."id" = "student_marks"."studentId" AND app_security.has_tenant_access(p."schoolId")))
  WITH CHECK (EXISTS (SELECT 1 FROM "students" p WHERE p."id" = "student_marks"."studentId" AND app_security.has_tenant_access(p."schoolId")));

ALTER TABLE "report_cards" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "report_cards"
  USING (EXISTS (SELECT 1 FROM "students" p WHERE p."id" = "report_cards"."studentId" AND app_security.has_tenant_access(p."schoolId")))
  WITH CHECK (EXISTS (SELECT 1 FROM "students" p WHERE p."id" = "report_cards"."studentId" AND app_security.has_tenant_access(p."schoolId")));

ALTER TABLE "assignment_submissions" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "assignment_submissions"
  USING (EXISTS (SELECT 1 FROM "assignments" p WHERE p."id" = "assignment_submissions"."assignmentId" AND app_security.has_tenant_access(p."schoolId")))
  WITH CHECK (EXISTS (SELECT 1 FROM "assignments" p WHERE p."id" = "assignment_submissions"."assignmentId" AND app_security.has_tenant_access(p."schoolId")));

ALTER TABLE "ai_messages" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "ai_messages"
  USING (EXISTS (SELECT 1 FROM "ai_conversations" p WHERE p."id" = "ai_messages"."conversationId" AND app_security.has_tenant_access(p."schoolId")))
  WITH CHECK (EXISTS (SELECT 1 FROM "ai_conversations" p WHERE p."id" = "ai_messages"."conversationId" AND app_security.has_tenant_access(p."schoolId")));
