-- ============================================================================
-- Multi-League Migration
-- Creates League, UserLeague, LeagueSettings tables.
-- Adds leagueId to Season, AdminUser, AdminAuditLog.
-- Migrates AppSettings data to LeagueSettings, then drops AppSettings.
-- Backfills all existing data into a default "SNFLP" holding league.
-- ============================================================================

-- 1. Create League table
CREATE TABLE "League" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "League_pkey" PRIMARY KEY ("id")
);

-- 2. Insert default holding league
INSERT INTO "League" ("id", "name", "createdAt", "updatedAt")
VALUES ('default-league', 'SNFLP', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

-- 3. Create UserLeague table
CREATE TABLE "UserLeague" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "leagueId" TEXT NOT NULL,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserLeague_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "UserLeague_userId_leagueId_key" ON "UserLeague"("userId", "leagueId");
ALTER TABLE "UserLeague" ADD CONSTRAINT "UserLeague_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UserLeague" ADD CONSTRAINT "UserLeague_leagueId_fkey" FOREIGN KEY ("leagueId") REFERENCES "League"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 4. Backfill: every existing user → default league
INSERT INTO "UserLeague" ("id", "userId", "leagueId", "joinedAt")
SELECT gen_random_uuid()::text, "id", 'default-league', CURRENT_TIMESTAMP FROM "User";

-- 5. Create LeagueSettings table
CREATE TABLE "LeagueSettings" (
    "id" TEXT NOT NULL,
    "leagueId" TEXT NOT NULL,
    "mode" TEXT NOT NULL DEFAULT 'live',
    "testSeasonId" TEXT,
    "testWeekId" TEXT,
    "emailRemindersEnabled" BOOLEAN NOT NULL DEFAULT false,
    "reminderDayOfWeek" INTEGER NOT NULL DEFAULT 4,
    "reminderHourUtc" INTEGER NOT NULL DEFAULT 12,
    "reminderMinuteUtc" INTEGER NOT NULL DEFAULT 0,
    "reminderOnlyUnsubmitted" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "LeagueSettings_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "LeagueSettings_leagueId_key" ON "LeagueSettings"("leagueId");
ALTER TABLE "LeagueSettings" ADD CONSTRAINT "LeagueSettings_leagueId_fkey" FOREIGN KEY ("leagueId") REFERENCES "League"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 6. Migrate AppSettings data into LeagueSettings for the default league
INSERT INTO "LeagueSettings" ("id", "leagueId", "mode", "testSeasonId", "testWeekId",
    "emailRemindersEnabled", "reminderDayOfWeek", "reminderHourUtc", "reminderMinuteUtc",
    "reminderOnlyUnsubmitted")
SELECT gen_random_uuid()::text, 'default-league', "mode", "testSeasonId", "testWeekId",
    "emailRemindersEnabled", "reminderDayOfWeek", "reminderHourUtc", "reminderMinuteUtc",
    "reminderOnlyUnsubmitted"
FROM "AppSettings"
LIMIT 1;

-- If no AppSettings row existed, create default settings
INSERT INTO "LeagueSettings" ("id", "leagueId")
SELECT gen_random_uuid()::text, 'default-league'
WHERE NOT EXISTS (SELECT 1 FROM "LeagueSettings" WHERE "leagueId" = 'default-league');

-- 7. Drop old AppSettings table
DROP TABLE "AppSettings";

-- 8. Add leagueId to Season (nullable → backfill → NOT NULL)
ALTER TABLE "Season" ADD COLUMN "leagueId" TEXT;
UPDATE "Season" SET "leagueId" = 'default-league';
ALTER TABLE "Season" ALTER COLUMN "leagueId" SET NOT NULL;
ALTER TABLE "Season" ADD CONSTRAINT "Season_leagueId_fkey" FOREIGN KEY ("leagueId") REFERENCES "League"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Drop old unique constraint, add new one with leagueId
ALTER TABLE "Season" DROP CONSTRAINT "Season_year_type_key";
CREATE UNIQUE INDEX "Season_year_type_leagueId_key" ON "Season"("year", "type", "leagueId");

-- 9. Add leagueId to AdminUser (nullable → backfill → NOT NULL)
ALTER TABLE "AdminUser" ADD COLUMN "leagueId" TEXT;
UPDATE "AdminUser" SET "leagueId" = 'default-league';
ALTER TABLE "AdminUser" ALTER COLUMN "leagueId" SET NOT NULL;
ALTER TABLE "AdminUser" ADD CONSTRAINT "AdminUser_leagueId_fkey" FOREIGN KEY ("leagueId") REFERENCES "League"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- 10. Add optional leagueId to AdminAuditLog for filtering
ALTER TABLE "AdminAuditLog" ADD COLUMN "leagueId" TEXT;
UPDATE "AdminAuditLog" SET "leagueId" = 'default-league';
