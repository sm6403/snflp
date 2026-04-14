import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAdminSession } from "@/lib/admin-auth";

// PATCH /api/admin/users/bulk-favorite-lock
// Sets favoriteTeamLocked for ALL regular users at once.
export async function PATCH(request: Request) {
  if (!(await verifyAdminSession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  if (typeof body.locked !== "boolean") {
    return NextResponse.json({ error: "locked must be a boolean" }, { status: 400 });
  }

  const { count } = await prisma.user.updateMany({
    data: { favoriteTeamLocked: body.locked },
  });

  return NextResponse.json({ updated: count, locked: body.locked });
}
