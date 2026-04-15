import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAdminSession, getAdminSession } from "@/lib/admin-auth";
import { getAdminLeagueId } from "@/lib/league-context";

// PATCH /api/admin/users/bulk-favorite-lock
// Sets favoriteTeamLocked for all regular users in the admin's league.
export async function PATCH(request: Request) {
  if (!(await verifyAdminSession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  if (typeof body.locked !== "boolean") {
    return NextResponse.json({ error: "locked must be a boolean" }, { status: 400 });
  }

  const adminSession = await getAdminSession();
  const leagueId = await getAdminLeagueId(adminSession);

  const { count } = await prisma.user.updateMany({
    where: leagueId ? { userLeagues: { some: { leagueId } } } : undefined,
    data: { favoriteTeamLocked: body.locked },
  });

  return NextResponse.json({ updated: count, locked: body.locked });
}
