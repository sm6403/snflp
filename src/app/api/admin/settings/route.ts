import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAdminSession } from "@/lib/admin-auth";

export async function GET() {
  if (!(await verifyAdminSession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const settings = await prisma.appSettings.findFirst();
  const seasons = await prisma.season.findMany({
    orderBy: { year: "desc" },
    include: {
      weeks: {
        orderBy: { number: "asc" },
        select: { id: true, number: true, label: true, isCurrent: true },
      },
    },
  });

  return NextResponse.json({ settings, seasons });
}

export async function PATCH(request: Request) {
  if (!(await verifyAdminSession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json() as {
    mode?: string;
    testSeasonId?: string | null;
    testWeekId?: string | null;
  };

  if (body.mode !== undefined && body.mode !== "live" && body.mode !== "test") {
    return NextResponse.json({ error: "Invalid mode" }, { status: 400 });
  }

  const settings = await prisma.appSettings.upsert({
    where: { id: "singleton" },
    create: {
      id: "singleton",
      mode: body.mode ?? "live",
      testSeasonId: body.testSeasonId ?? null,
      testWeekId: body.testWeekId ?? null,
    },
    update: {
      ...(body.mode !== undefined && { mode: body.mode }),
      ...(body.testSeasonId !== undefined && { testSeasonId: body.testSeasonId }),
      ...(body.testWeekId !== undefined && { testWeekId: body.testWeekId }),
    },
  });

  return NextResponse.json({ settings });
}
