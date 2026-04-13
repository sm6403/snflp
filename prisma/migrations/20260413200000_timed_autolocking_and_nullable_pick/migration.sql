-- Add timedAutolocking to Season
ALTER TABLE "Season" ADD COLUMN "timedAutolocking" BOOLEAN NOT NULL DEFAULT false;

-- Make Pick.pickedTeamId nullable (null = missed time-locked game)
ALTER TABLE "Pick" ALTER COLUMN "pickedTeamId" DROP NOT NULL;
