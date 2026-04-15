-- Idempotent migration: safe to re-run if a previous attempt partially committed
-- (Neon connection pooler may not fully roll back DDL on failure)

-- Add columns (IF NOT EXISTS so re-runs don't fail)
ALTER TABLE "League" ADD COLUMN IF NOT EXISTS "inviteCode" TEXT;
ALTER TABLE "League" ADD COLUMN IF NOT EXISTS "requireApproval" BOOLEAN NOT NULL DEFAULT false;

-- Backfill only rows where inviteCode is still NULL.
-- md5(id || clock_timestamp()) is unique per row (id is unique; clock_timestamp
-- advances during execution) and uses only built-in PostgreSQL functions —
-- no pgcrypto extension required.
UPDATE "League"
SET "inviteCode" = UPPER(SUBSTR(md5(id || clock_timestamp()::text), 1, 6))
WHERE "inviteCode" IS NULL;

-- Make NOT NULL (no-op if already set)
ALTER TABLE "League" ALTER COLUMN "inviteCode" SET NOT NULL;

-- Unique index (IF NOT EXISTS so re-runs don't fail)
CREATE UNIQUE INDEX IF NOT EXISTS "League_inviteCode_key" ON "League"("inviteCode");

-- Create LeagueJoinRequest table (IF NOT EXISTS)
CREATE TABLE IF NOT EXISTS "LeagueJoinRequest" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "leagueId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "LeagueJoinRequest_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "LeagueJoinRequest_userId_leagueId_key" ON "LeagueJoinRequest"("userId", "leagueId");

-- Foreign keys (check pg_constraint so adding twice doesn't error)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'LeagueJoinRequest_userId_fkey'
  ) THEN
    ALTER TABLE "LeagueJoinRequest" ADD CONSTRAINT "LeagueJoinRequest_userId_fkey"
        FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'LeagueJoinRequest_leagueId_fkey'
  ) THEN
    ALTER TABLE "LeagueJoinRequest" ADD CONSTRAINT "LeagueJoinRequest_leagueId_fkey"
        FOREIGN KEY ("leagueId") REFERENCES "League"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
