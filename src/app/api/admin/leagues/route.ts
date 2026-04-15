import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminSession, verifyIsSuperAdmin } from "@/lib/admin-auth";
import { logAdminAction } from "@/lib/admin-log";
import { generateUniqueInviteCode } from "@/lib/invite-code";

// GET /api/admin/leagues — list leagues visible to the current admin
export async function GET() {
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const where =
    session.role === "superadmin" ? {} : { id: session.leagueId };

  const leagues = await prisma.league.findMany({
    where,
    select: {
      id: true,
      name: true,
      inviteCode: true,
      requireApproval: true,
      createdAt: true,
      _count: { select: { userLeagues: true, seasons: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json({ leagues });
}

// POST /api/admin/leagues — create a new league (superadmin only)
export async function POST(request: Request) {
  if (!(await verifyIsSuperAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { name } = (await request.json()) as { name: string };

  if (!name?.trim()) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }

  const inviteCode = await generateUniqueInviteCode();

  const league = await prisma.league.create({
    data: {
      name: name.trim(),
      inviteCode,
      settings: { create: {} },
    },
    include: { settings: true },
  });

  await logAdminAction("superadmin", "CREATE_LEAGUE", {
    leagueId: league.id,
    name: league.name,
  });

  return NextResponse.json({ league }, { status: 201 });
}
