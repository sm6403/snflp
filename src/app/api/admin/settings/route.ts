import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminRole, verifyAdminSession } from "@/lib/admin-auth";
import { sendEmail } from "@/lib/email";
import { thursdayTemplate } from "@/lib/email-templates";

export async function GET() {
  const role = await getAdminRole();
  if (!role) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const isSuperAdmin = role === "superadmin";
  const settings = await prisma.appSettings.findFirst();
  // Settings page uses seasons for the test-week selector — return all seasons
  // ordered by year desc, type asc so regular comes before postseason per year
  const seasons = await prisma.season.findMany({
    orderBy: [{ year: "desc" }, { type: "asc" }],
    include: {
      weeks: {
        orderBy: { number: "asc" },
        select: { id: true, number: true, label: true, isCurrent: true },
      },
    },
  });

  return NextResponse.json({ settings, seasons, isSuperAdmin });
}

export async function PATCH(request: Request) {
  if (!(await verifyAdminSession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json() as {
    mode?: string;
    testSeasonId?: string | null;
    testWeekId?: string | null;
    emailRemindersEnabled?: boolean;
    reminderDayOfWeek?: number;
    reminderHourUtc?: number;
    reminderMinuteUtc?: number;
    reminderOnlyUnsubmitted?: boolean;
    action?: "testEmail";
    testEmailAddress?: string;
  };

  // ── Test email action ────────────────────────────────────────────────────────
  if (body.action === "testEmail") {
    const address = body.testEmailAddress?.trim();
    if (!address || !address.includes("@")) {
      return NextResponse.json({ error: "Invalid email address" }, { status: 400 });
    }
    const appUrl = (process.env.APP_URL ?? "").replace(/\/$/, "");
    const week = await prisma.week.findFirst({
      where: { isCurrent: true },
      include: { season: { select: { year: true } } },
    });
    const { subject, html } = thursdayTemplate({
      userName: "Admin",
      weekLabel: week?.label ?? "Test Week",
      seasonYear: week?.season.year ?? new Date().getFullYear(),
      appUrl,
    });
    try {
      await sendEmail({ to: address, subject: `[TEST] ${subject}`, html });
      return NextResponse.json({ success: true, sentTo: address });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to send";
      return NextResponse.json({ error: msg }, { status: 500 });
    }
  }

  if (body.mode !== undefined && body.mode !== "live" && body.mode !== "test") {
    return NextResponse.json({ error: "Invalid mode" }, { status: 400 });
  }

  // Validate schedule fields if provided
  if (body.reminderDayOfWeek !== undefined && (body.reminderDayOfWeek < 0 || body.reminderDayOfWeek > 6)) {
    return NextResponse.json({ error: "reminderDayOfWeek must be 0–6" }, { status: 400 });
  }
  if (body.reminderHourUtc !== undefined && (body.reminderHourUtc < 0 || body.reminderHourUtc > 23)) {
    return NextResponse.json({ error: "reminderHourUtc must be 0–23" }, { status: 400 });
  }
  if (body.reminderMinuteUtc !== undefined && (body.reminderMinuteUtc < 0 || body.reminderMinuteUtc > 59)) {
    return NextResponse.json({ error: "reminderMinuteUtc must be 0–59" }, { status: 400 });
  }

  const settings = await prisma.appSettings.upsert({
    where: { id: "singleton" },
    create: {
      id: "singleton",
      mode: body.mode ?? "live",
      testSeasonId: body.testSeasonId ?? null,
      testWeekId: body.testWeekId ?? null,
      emailRemindersEnabled: body.emailRemindersEnabled ?? false,
      reminderDayOfWeek: body.reminderDayOfWeek ?? 4,
      reminderHourUtc: body.reminderHourUtc ?? 12,
      reminderMinuteUtc: body.reminderMinuteUtc ?? 0,
      reminderOnlyUnsubmitted: body.reminderOnlyUnsubmitted ?? false,
    },
    update: {
      ...(body.mode !== undefined && { mode: body.mode }),
      ...(body.testSeasonId !== undefined && { testSeasonId: body.testSeasonId }),
      ...(body.testWeekId !== undefined && { testWeekId: body.testWeekId }),
      ...(body.emailRemindersEnabled !== undefined && { emailRemindersEnabled: body.emailRemindersEnabled }),
      ...(body.reminderDayOfWeek !== undefined && { reminderDayOfWeek: body.reminderDayOfWeek }),
      ...(body.reminderHourUtc !== undefined && { reminderHourUtc: body.reminderHourUtc }),
      ...(body.reminderMinuteUtc !== undefined && { reminderMinuteUtc: body.reminderMinuteUtc }),
      ...(body.reminderOnlyUnsubmitted !== undefined && { reminderOnlyUnsubmitted: body.reminderOnlyUnsubmitted }),
    },
  });

  return NextResponse.json({ settings });
}
