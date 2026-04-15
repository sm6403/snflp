import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminSession, getAdminName } from "@/lib/admin-auth";
import { getAdminLeagueId } from "@/lib/league-context";
import { generateUniqueInviteCode } from "@/lib/invite-code";
import { logAdminAction } from "@/lib/admin-log";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ leagueId: string }> },
) {
  const adminSession = await getAdminSession();
  if (!adminSession) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { leagueId } = await params;
  const adminLeagueId = await getAdminLeagueId(adminSession);

  // Must be superadmin or admin of this specific league
  if (adminSession.role !== "superadmin" && adminLeagueId !== leagueId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const newCode = await generateUniqueInviteCode();
  const league = await prisma.league.update({
    where: { id: leagueId },
    data: { inviteCode: newCode },
    select: { id: true, name: true, inviteCode: true },
  });

  const adminName = (await getAdminName()) ?? "unknown";
  await logAdminAction(adminName, "REGENERATE_INVITE_CODE", {
    leagueName: league.name,
  });

  return NextResponse.json({ league });
}
