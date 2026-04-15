-- Add automatic result processing settings to LeagueSettings
ALTER TABLE "LeagueSettings" ADD COLUMN "autoResultsEnabled"    BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "LeagueSettings" ADD COLUMN "autoResultsDayOfWeek"  INTEGER NOT NULL DEFAULT 2;
ALTER TABLE "LeagueSettings" ADD COLUMN "autoResultsHourUtc"    INTEGER NOT NULL DEFAULT 12;
ALTER TABLE "LeagueSettings" ADD COLUMN "autoResultsMinuteUtc"  INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "LeagueSettings" ADD COLUMN "autoResultsAdvanceWeek" BOOLEAN NOT NULL DEFAULT false;
