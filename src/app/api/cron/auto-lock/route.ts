import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET /api/cron/auto-lock
// Called on a schedule. Locks any weeks whose lockAt time has passed.
// Protected by CRON_SECRET env var (passed as ?secret=... or Authorization header).
export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const { searchParams } = new URL(request.url);
    const headerSecret = request.headers.get("authorization")?.replace("Bearer ", "");
    const querySecret = searchParams.get("secret");
    if (headerSecret !== cronSecret && querySecret !== cronSecret) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const now = new Date();

  // Find all weeks with a lockAt in the past that are not yet locked
  const weeksToLock = await prisma.week.findMany({
    where: {
      lockAt: { lte: now },
      lockedForSubmission: false,
    },
    select: { id: true, label: true, lockAt: true },
  });

  if (weeksToLock.length === 0) {
    return NextResponse.json({ locked: 0, weeks: [] });
  }

  // Lock them all
  await prisma.week.updateMany({
    where: { id: { in: weeksToLock.map((w) => w.id) } },
    data: { lockedForSubmission: true },
  });

  return NextResponse.json({
    locked: weeksToLock.length,
    weeks: weeksToLock.map((w) => ({ id: w.id, label: w.label, lockAt: w.lockAt })),
  });
}
