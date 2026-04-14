-- Add custom rule flags to Season
ALTER TABLE "Season" ADD COLUMN "ruleFavouriteTeamBonusWin" BOOLEAN NOT NULL DEFAULT false;
