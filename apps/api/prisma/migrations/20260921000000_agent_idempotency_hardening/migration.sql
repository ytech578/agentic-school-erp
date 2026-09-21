-- ============================================================
-- Migration: agent_idempotency_hardening
-- Adds operationFingerprint column to agent_actions.
-- Separates the business-mutation fingerprint from the
-- client-level request idempotency key (idempotencyKey).
-- Safe to run multiple times (all statements are idempotent).
-- ============================================================

-- AddColumn: operationFingerprint (nullable, will be populated by service)
ALTER TABLE "agent_actions"
  ADD COLUMN IF NOT EXISTS "operationFingerprint" TEXT;

-- AddUniqueConstraint
DO $$ BEGIN
  ALTER TABLE "agent_actions"
    ADD CONSTRAINT "agent_actions_operationFingerprint_key"
    UNIQUE ("operationFingerprint");
EXCEPTION
  WHEN duplicate_object THEN null;
  WHEN duplicate_table   THEN null;
END $$;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "agent_actions_operationFingerprint_idx"
    ON "agent_actions"("operationFingerprint");
