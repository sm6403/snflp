import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAdminSession } from "@/lib/admin-auth";

// GET /api/admin/audit-log?limit=50&offset=0&admin=&action=
export async function GET(request: Request) {
  if (!(await verifyAdminSession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "50", 10), 200);
  const offset = parseInt(searchParams.get("offset") ?? "0", 10);
  const adminFilter = searchParams.get("admin") ?? "";
  const actionFilter = searchParams.get("action") ?? "";

  const where: Record<string, unknown> = {};
  if (adminFilter) where.adminName = adminFilter;
  if (actionFilter) where.action = actionFilter;

  const [entries, total] = await Promise.all([
    prisma.adminAuditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: limit,
      skip: offset,
    }),
    prisma.adminAuditLog.count({ where }),
  ]);

  // Also return the distinct admin names and action types for filter dropdowns
  const [admins, actions] = await Promise.all([
    prisma.adminAuditLog.findMany({
      select: { adminName: true },
      distinct: ["adminName"],
      orderBy: { adminName: "asc" },
    }),
    prisma.adminAuditLog.findMany({
      select: { action: true },
      distinct: ["action"],
      orderBy: { action: "asc" },
    }),
  ]);

  return NextResponse.json({
    entries,
    total,
    limit,
    offset,
    admins: admins.map((a) => a.adminName),
    actions: actions.map((a) => a.action),
  });
}
