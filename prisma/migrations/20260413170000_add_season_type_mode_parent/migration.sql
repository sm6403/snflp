-- AlterTable: add type, mode, parentSeasonId to Season
ALTER TABLE "Season" ADD COLUMN "type" TEXT NOT NULL DEFAULT 'regular';
ALTER TABLE "Season" ADD COLUMN "mode" TEXT NOT NULL DEFAULT 'live';
ALTER TABLE "Season" ADD COLUMN "parentSeasonId" TEXT;

-- Drop old unique constraint on year
ALTER TABLE "Season" DROP CONSTRAINT IF EXISTS "Season_year_key";

-- Add new unique constraint on (year, type)
ALTER TABLE "Season" ADD CONSTRAINT "Season_year_type_key" UNIQUE ("year", "type");

-- AddForeignKey for self-relation
ALTER TABLE "Season" ADD CONSTRAINT "Season_parentSeasonId_fkey" FOREIGN KEY ("parentSeasonId") REFERENCES "Season"("id") ON DELETE SET NULL ON UPDATE CASCADE;
