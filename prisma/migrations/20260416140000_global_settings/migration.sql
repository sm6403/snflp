-- Remove newUsersStartDisabled from LeagueSettings (moving to GlobalSettings singleton)
ALTER TABLE "LeagueSettings" DROP COLUMN IF EXISTS "newUsersStartDisabled";

-- Create GlobalSettings singleton table
CREATE TABLE "GlobalSettings" (
  "id" TEXT NOT NULL DEFAULT 'global',
  "newUsersStartDisabled" BOOLEAN NOT NULL DEFAULT false,
  CONSTRAINT "GlobalSettings_pkey" PRIMARY KEY ("id")
);

-- Seed the single row with safe defaults
INSERT INTO "GlobalSettings" ("id", "newUsersStartDisabled") VALUES ('global', false)
ON CONFLICT ("id") DO NOTHING;
