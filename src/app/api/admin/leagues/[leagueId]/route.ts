import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminSession, getAdminName } from "@/lib/admin-auth";
import { getAdminLeagueId } from "@/lib/league-context";
import { logAdminAction } from "@/lib/admin-log";

// PATCH /api/admin/leagues/[leagueId] — update a league
// Superadmin can rename any league and change settings.
// DB admin can change settings (e.g. requireApproval) for their own league.
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ leagueId: string }> }
) {
  const adminSession = await getAdminSession();
  if (!adminSession) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { leagueId } = await params;
  const { name, requireApproval } = (await request.json()) as {
    name?: string;
    requireApproval?: boolean;
  };

  // DB admins can only update their own league, and cannot rename
  if (adminSession.role === "admin") {
    const adminLeagueId = await getAdminLeagueId(adminSession);
    if (adminLeagueId !== leagueId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    if (name !== undefined) {
      return NextResponse.json({ error: "Only superadmin can rename leagues" }, { status: 403 });
    }
  }

  if (name !== undefined && !name?.trim()) {
    return NextResponse.json({ error: "Name cannot be empty" }, { status: 400 });
  }

  const data: Record<string, unknown> = {};
  if (name !== undefined) data.name = name.trim();
  if (requireApproval !== undefined) data.requireApproval = requireApproval;

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 });
  }

  const league = await prisma.league.update({
    where: { id: leagueId },
    data,
  });

  const adminName = await getAdminName() ?? "unknown";
  await logAdminAction(adminName, "UPDATE_LEAGUE", {
    leagueId,
    ...data,
  });

  return NextResponse.json({ league });
}
