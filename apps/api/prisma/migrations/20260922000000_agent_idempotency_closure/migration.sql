-- ============================================================
-- Migration: 20260922000000_agent_idempotency_closure
-- Adds idempotencyScope and requestFingerprint columns to agent_actions.
-- Replaces global UNIQUE(idempotencyKey) with scoped
-- UNIQUE(idempotencyScope, idempotencyKey).
-- Safe to run multiple times (all statements are idempotent).
-- ============================================================

-- Step 1: Add new columns if they do not exist
ALTER TABLE "agent_actions"
  ADD COLUMN IF NOT EXISTS "idempotencyScope" TEXT,
  ADD COLUMN IF NOT EXISTS "requestFingerprint" TEXT;

-- Step 2: Backfill idempotencyScope for existing rows with idempotencyKey
UPDATE "agent_actions"
SET "idempotencyScope" = "schoolId" || ':' || "userId" || ':' || "toolName"
WHERE "idempotencyKey" IS NOT NULL AND "idempotencyScope" IS NULL;

-- Step 3: Safely drop old global unique constraint on idempotencyKey
ALTER TABLE "agent_actions"
  DROP CONSTRAINT IF EXISTS "agent_actions_idempotencyKey_key";
DROP INDEX IF EXISTS "agent_actions_idempotencyKey_key";

-- Step 4: Create composite unique constraint on (idempotencyScope, idempotencyKey)
DO $$ BEGIN
  ALTER TABLE "agent_actions"
    ADD CONSTRAINT "agent_actions_idempotencyScope_idempotencyKey_key"
    UNIQUE ("idempotencyScope", "idempotencyKey");
EXCEPTION
  WHEN duplicate_object THEN null;
  WHEN duplicate_table   THEN null;
END $$;

-- Step 5: Add supporting indexes
CREATE INDEX IF NOT EXISTS "agent_actions_idempotencyScope_idx"
  ON "agent_actions"("idempotencyScope");

CREATE INDEX IF NOT EXISTS "agent_actions_requestFingerprint_idx"
  ON "agent_actions"("requestFingerprint");
