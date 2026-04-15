-- Add inviteCode (nullable first) and requireApproval to League
ALTER TABLE "League" ADD COLUMN "inviteCode" TEXT;
ALTER TABLE "League" ADD COLUMN "requireApproval" BOOLEAN NOT NULL DEFAULT false;

-- Backfill existing leagues with random 6-char unique codes (one per row)
UPDATE "League" SET "inviteCode" = UPPER(SUBSTR(encode(gen_random_bytes(6), 'hex'), 1, 6));

-- Make NOT NULL and add unique constraint
ALTER TABLE "League" ALTER COLUMN "inviteCode" SET NOT NULL;
CREATE UNIQUE INDEX "League_inviteCode_key" ON "League"("inviteCode");

-- Create LeagueJoinRequest table
CREATE TABLE "LeagueJoinRequest" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "leagueId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "LeagueJoinRequest_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "LeagueJoinRequest_userId_leagueId_key" ON "LeagueJoinRequest"("userId", "leagueId");
ALTER TABLE "LeagueJoinRequest" ADD CONSTRAINT "LeagueJoinRequest_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LeagueJoinRequest" ADD CONSTRAINT "LeagueJoinRequest_leagueId_fkey"
    FOREIGN KEY ("leagueId") REFERENCES "League"("id") ON DELETE CASCADE ON UPDATE CASCADE;
