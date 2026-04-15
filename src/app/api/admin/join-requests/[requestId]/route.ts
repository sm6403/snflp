import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminSession, getAdminName } from "@/lib/admin-auth";
import { getAdminLeagueId } from "@/lib/league-context";
import { logAdminAction } from "@/lib/admin-log";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ requestId: string }> },
) {
  const adminSession = await getAdminSession();
  if (!adminSession) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const leagueId = await getAdminLeagueId(adminSession);
  if (!leagueId) {
    return NextResponse.json({ error: "No league context" }, { status: 400 });
  }

  const { requestId } = await params;
  const { action } = (await request.json()) as {
    action: "approve" | "reject";
  };

  if (action !== "approve" && action !== "reject") {
    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  }

  const joinRequest = await prisma.leagueJoinRequest.findUnique({
    where: { id: requestId },
    include: {
      user: { select: { id: true, name: true, email: true, alias: true } },
    },
  });

  if (!joinRequest || joinRequest.leagueId !== leagueId) {
    return NextResponse.json({ error: "Request not found" }, { status: 404 });
  }

  if (joinRequest.status !== "pending") {
    return NextResponse.json(
      { error: "Request already processed" },
      { status: 409 },
    );
  }

  const adminName = (await getAdminName()) ?? "unknown";
  const userLabel =
    joinRequest.user.alias ?? joinRequest.user.name ?? joinRequest.user.email;

  if (action === "approve") {
    await prisma.$transaction([
      prisma.leagueJoinRequest.update({
        where: { id: requestId },
        data: { status: "approved" },
      }),
      prisma.userLeague.create({
        data: { userId: joinRequest.userId, leagueId },
      }),
    ]);
    await logAdminAction(adminName, "APPROVE_JOIN_REQUEST", {
      user: userLabel,
    });
    return NextResponse.json({ ok: true, status: "approved" });
  }

  // reject
  await prisma.leagueJoinRequest.update({
    where: { id: requestId },
    data: { status: "rejected" },
  });
  await logAdminAction(adminName, "REJECT_JOIN_REQUEST", { user: userLabel });
  return NextResponse.json({ ok: true, status: "rejected" });
}
