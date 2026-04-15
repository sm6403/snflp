-- Add newUsersStartDisabled to LeagueSettings
-- When enabled, users who sign up will have their account start as disabled
-- until an admin manually activates them.
ALTER TABLE "LeagueSettings" ADD COLUMN "newUsersStartDisabled" BOOLEAN NOT NULL DEFAULT false;
