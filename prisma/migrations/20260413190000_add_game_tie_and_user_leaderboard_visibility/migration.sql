-- Add isTie to Game for tracking tied NFL games
ALTER TABLE "Game" ADD COLUMN "isTie" BOOLEAN NOT NULL DEFAULT false;

-- Add showOnLeaderboard to User to control leaderboard visibility
ALTER TABLE "User" ADD COLUMN "showOnLeaderboard" BOOLEAN NOT NULL DEFAULT true;
