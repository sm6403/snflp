-- Add auto-lock mode to LeagueSettings
ALTER TABLE "LeagueSettings" ADD COLUMN "autoLockMode" TEXT NOT NULL DEFAULT 'off';

-- Add per-game lock timestamp to Game
ALTER TABLE "Game" ADD COLUMN "lockedAt" TIMESTAMP(3);
