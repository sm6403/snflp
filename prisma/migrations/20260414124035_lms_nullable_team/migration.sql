-- DropForeignKey
ALTER TABLE "LmsPick" DROP CONSTRAINT "LmsPick_teamId_fkey";

-- AlterTable
ALTER TABLE "LmsPick" ALTER COLUMN "teamId" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "LmsPick" ADD CONSTRAINT "LmsPick_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;
