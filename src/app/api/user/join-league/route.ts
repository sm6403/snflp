import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { setUserLeagueCookie } from "@/lib/league-context";

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { inviteCode } = (await request.json()) as { inviteCode: string };
  if (!inviteCode?.trim()) {
    return NextResponse.json(
      { error: "Invite code is required" },
      { status: 400 },
    );
  }

  const league = await prisma.league.findUnique({
    where: { inviteCode: inviteCode.trim().toUpperCase() },
    select: { id: true, name: true, requireApproval: true },
  });
  if (!league) {
    return NextResponse.json(
      { error: "Invalid invite code" },
      { status: 404 },
    );
  }

  // Check if already a member
  const existing = await prisma.userLeague.findUnique({
    where: {
      userId_leagueId: { userId: session.user.id, leagueId: league.id },
    },
  });
  if (existing) {
    return NextResponse.json(
      { error: "You are already a member of this league" },
      { status: 409 },
    );
  }

  if (!league.requireApproval) {
    // Direct join
    await prisma.userLeague.create({
      data: { userId: session.user.id, leagueId: league.id },
    });
    const response = NextResponse.json({
      joined: true,
      league: { id: league.id, name: league.name },
    });
    response.headers.append("Set-Cookie", setUserLeagueCookie(league.id));
    return response;
  }

  // Requires approval — create join request
  const existingRequest = await prisma.leagueJoinRequest.findUnique({
    where: {
      userId_leagueId: { userId: session.user.id, leagueId: league.id },
    },
  });
  if (existingRequest) {
    if (existingRequest.status === "pending") {
      return NextResponse.json(
        { error: "You already have a pending request for this league" },
        { status: 409 },
      );
    }
    if (existingRequest.status === "rejected") {
      // Allow re-request after rejection by updating status back to pending
      await prisma.leagueJoinRequest.update({
        where: { id: existingRequest.id },
        data: { status: "pending" },
      });
      return NextResponse.json({
        pending: true,
        league: { id: league.id, name: league.name },
      });
    }
  }

  await prisma.leagueJoinRequest.create({
    data: { userId: session.user.id, leagueId: league.id },
  });
  return NextResponse.json({
    pending: true,
    league: { id: league.id, name: league.name },
  });
}
