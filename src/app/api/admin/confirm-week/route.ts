import { NextResponse } from "next/server";
import { verifyAdminSession, getAdminName } from "@/lib/admin-auth";
import { confirmWeek } from "@/lib/confirm-week";

// POST /api/admin/confirm-week
// Bulk-grades all picks for the week, stamps Week.confirmedAt, and
// recomputes cumulative team records (W-L-T) for all teams that have
// played confirmed games in this season.
//
// Core logic lives in src/lib/confirm-week.ts (shared with auto-results cron).
export async function POST(request: Request) {
  if (!(await verifyAdminSession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { weekId } = (await request.json()) as { weekId: string };
  if (!weekId) {
    return NextResponse.json({ error: "weekId required" }, { status: 400 });
  }

  const callerName = (await getAdminName()) ?? "unknown";

  try {
    const { picksGraded, confirmedAt } = await confirmWeek(weekId, callerName);
    return NextResponse.json({ gradedCount: picksGraded, confirmedAt });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to confirm week";
    const status =
      msg.includes("not found") ? 404 :
      msg.includes("locked") || msg.includes("winner") ? 400 :
      500;
    return NextResponse.json({ error: msg }, { status });
  }
}
