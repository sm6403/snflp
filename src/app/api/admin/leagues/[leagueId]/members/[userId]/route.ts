import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyIsSuperAdmin } from "@/lib/admin-auth";
import { logAdminAction } from "@/lib/admin-log";

// DELETE /api/admin/leagues/[leagueId]/members/[userId] — remove user from league (superadmin only)
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ leagueId: string; userId: string }> }
) {
  if (!(await verifyIsSuperAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { leagueId, userId } = await params;

  await prisma.userLeague.delete({
    where: { userId_leagueId: { userId, leagueId } },
  });

  await logAdminAction("superadmin", "REMOVE_LEAGUE_MEMBER", {
    leagueId,
    userId,
  });

  return NextResponse.json({ ok: true });
}
