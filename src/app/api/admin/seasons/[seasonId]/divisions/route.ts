import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAdminSession } from "@/lib/admin-auth";

type Params = { params: Promise<{ seasonId: string }> };

// GET /api/admin/seasons/[seasonId]/divisions
// Returns all divisions for the season, each with member count.
export async function GET(_request: Request, { params }: Params) {
  if (!(await verifyAdminSession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { seasonId } = await params;

  const season = await prisma.season.findUnique({
    where: { id: seasonId },
    select: { id: true, usesDivisions: true, leagueId: true },
  });
  if (!season) return NextResponse.json({ error: "Season not found" }, { status: 404 });

  const divisions = await prisma.division.findMany({
    where: { seasonId },
    orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
    include: { _count: { select: { userDivisions: true } } },
  });

  // All active users in this league, with their explicit division assignment for this season
  const allUsers = await prisma.user.findMany({
    where: { disabled: false, userLeagues: { some: { leagueId: season.leagueId } } },
    select: {
      id: true,
      name: true,
      alias: true,
      email: true,
      divisionMemberships: {
        where: { seasonId },
        select: { divisionId: true },
      },
    },
    orderBy: { email: "asc" },
  });

  const defaultDivision = divisions.find((d) => d.isDefault);

  // Map each user to their effective division id
  const usersWithDivision = allUsers.map((u) => ({
    id: u.id,
    displayName: u.alias ?? u.name ?? u.email,
    divisionId: u.divisionMemberships[0]?.divisionId ?? defaultDivision?.id ?? null,
  }));

  return NextResponse.json({ divisions, users: usersWithDivision });
}

// POST /api/admin/seasons/[seasonId]/divisions
// Creates a new non-default division.
export async function POST(request: Request, { params }: Params) {
  if (!(await verifyAdminSession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { seasonId } = await params;

  const season = await prisma.season.findUnique({ where: { id: seasonId } });
  if (!season) return NextResponse.json({ error: "Season not found" }, { status: 404 });

  const { name } = await request.json();
  if (typeof name !== "string" || !name.trim()) {
    return NextResponse.json({ error: "Division name is required" }, { status: 400 });
  }

  try {
    const division = await prisma.division.create({
      data: { seasonId, name: name.trim(), isDefault: false },
      include: { _count: { select: { userDivisions: true } } },
    });
    return NextResponse.json({ division }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "A division with that name already exists" }, { status: 409 });
  }
}
