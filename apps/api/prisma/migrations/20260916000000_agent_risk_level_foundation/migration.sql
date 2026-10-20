-- RiskLevel was required by the original agent_actions migration but omitted
-- from the migration history. Keeping this repair in an earlier, additive
-- migration preserves the checksum of already-released migrations.
DO $$ BEGIN
  CREATE TYPE "RiskLevel" AS ENUM ('NONE', 'LOW', 'MEDIUM', 'HIGH');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
