ALTER TABLE "AdminUser" ADD COLUMN "lastLoginAt" TIMESTAMP(3);

CREATE TABLE "AdminAuditLog" (
  "id"        TEXT NOT NULL,
  "adminName" TEXT NOT NULL,
  "action"    TEXT NOT NULL,
  "detail"    TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AdminAuditLog_pkey" PRIMARY KEY ("id")
);
