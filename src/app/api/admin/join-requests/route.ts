import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/admin-auth";
import { getAdminLeagueId } from "@/lib/league-context";

export async function GET() {
  const adminSession = await getAdminSession();
  if (!adminSession) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const leagueId = await getAdminLeagueId(adminSession);
  if (!leagueId) {
    return NextResponse.json({ error: "No league context" }, { status: 400 });
  }

  const requests = await prisma.leagueJoinRequest.findMany({
    where: { leagueId, status: "pending" },
    include: {
      user: { select: { id: true, name: true, email: true, alias: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json({ requests });
}
