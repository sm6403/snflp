import { NextResponse } from "next/server";
import { verifyIsSuperAdmin } from "@/lib/admin-auth";
import { setAdminLeagueCookie } from "@/lib/league-context";
import { logAdminAction } from "@/lib/admin-log";

// POST /api/admin/leagues/set-context — set the admin league context cookie (superadmin only)
export async function POST(request: Request) {
  if (!(await verifyIsSuperAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { leagueId } = (await request.json()) as { leagueId: string };

  if (!leagueId?.trim()) {
    return NextResponse.json(
      { error: "leagueId is required" },
      { status: 400 }
    );
  }

  await logAdminAction("superadmin", "SET_LEAGUE_CONTEXT", { leagueId });

  return new NextResponse(JSON.stringify({ ok: true }), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Set-Cookie": setAdminLeagueCookie(leagueId.trim()),
    },
  });
}
