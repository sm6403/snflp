-- Add favoriteTeamLocked to User (default false — no existing picks are locked)
ALTER TABLE "User" ADD COLUMN "favoriteTeamLocked" BOOLEAN NOT NULL DEFAULT false;
