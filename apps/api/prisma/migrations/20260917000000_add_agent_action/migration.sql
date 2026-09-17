-- ============================================================
-- Migration: add_agent_action
-- Adds AgentActionStatus enum and agent_actions table
-- with all indexes and FK to schools.
-- Safe to run against an existing database that already has
-- the 20260805150215_init migration applied.
-- ============================================================

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "AgentActionStatus" AS ENUM (
    'PROPOSED',
    'AWAITING_CONFIRMATION',
    'CONFIRMED',
    'EXECUTING',
    'SUCCEEDED',
    'FAILED',
    'REJECTED',
    'EXPIRED',
    'CANCELLED'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- CreateTable
CREATE TABLE IF NOT EXISTS "agent_actions" (
    "id"                   TEXT NOT NULL,
    "schoolId"             TEXT NOT NULL,
    "userId"               TEXT NOT NULL,
    "toolName"             TEXT NOT NULL,
    "arguments"            JSONB NOT NULL,
    "riskLevel"            "RiskLevel" NOT NULL DEFAULT 'MEDIUM',
    "status"               "AgentActionStatus" NOT NULL DEFAULT 'PROPOSED',
    "requiresConfirmation" BOOLEAN NOT NULL DEFAULT false,
    "label"                TEXT NOT NULL,
    "explanation"          TEXT,
    "idempotencyKey"       TEXT,
    "correlationId"        TEXT,
    "expiresAt"            TIMESTAMP(3),
    "confirmedAt"          TIMESTAMP(3),
    "confirmedBy"          TEXT,
    "executedAt"           TIMESTAMP(3),
    "result"               JSONB,
    "failureReason"        TEXT,
    "createdAt"            TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"            TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "agent_actions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "agent_actions_idempotencyKey_key"
    ON "agent_actions"("idempotencyKey");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "agent_actions_userId_status_idx"
    ON "agent_actions"("userId", "status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "agent_actions_schoolId_status_createdAt_idx"
    ON "agent_actions"("schoolId", "status", "createdAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "agent_actions_idempotencyKey_idx"
    ON "agent_actions"("idempotencyKey");

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "agent_actions"
    ADD CONSTRAINT "agent_actions_schoolId_fkey"
    FOREIGN KEY ("schoolId") REFERENCES "schools"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
