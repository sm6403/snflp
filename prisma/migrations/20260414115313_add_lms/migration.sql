-- DropForeignKey
ALTER TABLE "Pick" DROP CONSTRAINT "Pick_pickedTeamId_fkey";

-- DropIndex
DROP INDEX "Season_year_key";

-- AlterTable
ALTER TABLE "Season" ADD COLUMN     "ruleLMS" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "LmsPick" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "weekId" TEXT NOT NULL,
    "seasonId" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "eliminated" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LmsPick_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "LmsPick_userId_weekId_key" ON "LmsPick"("userId", "weekId");

-- AddForeignKey
ALTER TABLE "Pick" ADD CONSTRAINT "Pick_pickedTeamId_fkey" FOREIGN KEY ("pickedTeamId") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LmsPick" ADD CONSTRAINT "LmsPick_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LmsPick" ADD CONSTRAINT "LmsPick_weekId_fkey" FOREIGN KEY ("weekId") REFERENCES "Week"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LmsPick" ADD CONSTRAINT "LmsPick_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "Season"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LmsPick" ADD CONSTRAINT "LmsPick_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
