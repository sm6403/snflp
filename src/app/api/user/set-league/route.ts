import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { setUserLeagueCookie } from "@/lib/league-context";

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { leagueId } = await request.json();

  if (typeof leagueId !== "string" || !leagueId) {
    return NextResponse.json({ error: "Invalid leagueId" }, { status: 400 });
  }

  // Validate the user is a member of this league
  const membership = await prisma.userLeague.findUnique({
    where: { userId_leagueId: { userId: session.user.id, leagueId } },
  });

  if (!membership) {
    return NextResponse.json({ error: "Not a member of this league" }, { status: 403 });
  }

  const response = NextResponse.json({ ok: true });
  response.headers.append("Set-Cookie", setUserLeagueCookie(leagueId));
  return response;
}
