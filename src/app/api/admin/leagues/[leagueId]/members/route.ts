import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyIsSuperAdmin } from "@/lib/admin-auth";
import { logAdminAction } from "@/lib/admin-log";

// GET /api/admin/leagues/[leagueId]/members — list league members (superadmin only)
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ leagueId: string }> }
) {
  if (!(await verifyIsSuperAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { leagueId } = await params;

  const userLeagues = await prisma.userLeague.findMany({
    where: { leagueId },
    select: {
      joinedAt: true,
      user: {
        select: { id: true, name: true, email: true, alias: true },
      },
    },
    orderBy: { joinedAt: "asc" },
  });

  const members = userLeagues.map((ul) => ({
    id: ul.user.id,
    name: ul.user.name,
    email: ul.user.email,
    alias: ul.user.alias,
    joinedAt: ul.joinedAt,
  }));

  return NextResponse.json({ members });
}

// POST /api/admin/leagues/[leagueId]/members — add a user to the league (superadmin only)
export async function POST(
  request: Request,
  { params }: { params: Promise<{ leagueId: string }> }
) {
  if (!(await verifyIsSuperAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { leagueId } = await params;
  const { userId } = (await request.json()) as { userId: string };

  if (!userId?.trim()) {
    return NextResponse.json({ error: "userId is required" }, { status: 400 });
  }

  const existing = await prisma.userLeague.findUnique({
    where: { userId_leagueId: { userId, leagueId } },
  });
  if (existing) {
    return NextResponse.json(
      { error: "User is already a member of this league" },
      { status: 409 }
    );
  }

  const membership = await prisma.userLeague.create({
    data: { userId, leagueId },
  });

  await logAdminAction("superadmin", "ADD_LEAGUE_MEMBER", {
    leagueId,
    userId,
  });

  return NextResponse.json({ membership }, { status: 201 });
}
