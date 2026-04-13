-- AlterTable
ALTER TABLE "User" ADD COLUMN     "lastLoginAt" TIMESTAMP(3),
ALTER COLUMN "disabled" SET DEFAULT true;
