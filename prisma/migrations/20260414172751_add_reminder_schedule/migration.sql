-- AlterTable
ALTER TABLE "AppSettings" ADD COLUMN     "reminderDayOfWeek" INTEGER NOT NULL DEFAULT 4,
ADD COLUMN     "reminderHourUtc" INTEGER NOT NULL DEFAULT 12,
ADD COLUMN     "reminderMinuteUtc" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "reminderOnlyUnsubmitted" BOOLEAN NOT NULL DEFAULT false;
