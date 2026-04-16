import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminRole, verifyAdminSession, getAdminSession } from "@/lib/admin-auth";
import { getAdminLeagueId } from "@/lib/league-context";
import { sendEmail } from "@/lib/email";
import { thursdayTemplate } from "@/lib/email-templates";

export async function GET() {
  const role = await getAdminRole();
  if (!role) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const isSuperAdmin = role === "superadmin";
  const adminSession = await getAdminSession();
  const leagueId = await getAdminLeagueId(adminSession);
  const settings = leagueId
    ? await prisma.leagueSettings.findUnique({ where: { leagueId } })
    : null;
  const globalSettings = isSuperAdmin
    ? await prisma.globalSettings.findUnique({ where: { id: "global" } })
    : null;
  // Settings page uses seasons for the test-week selector — scope to admin's league when present
  const seasons = await prisma.season.findMany({
    where: leagueId ? { leagueId } : undefined,
    orderBy: [{ year: "desc" }, { type: "asc" }],
    include: {
      weeks: {
        orderBy: { number: "asc" },
        select: { id: true, number: true, label: true, isCurrent: true },
      },
    },
  });

  return NextResponse.json({ settings, seasons, isSuperAdmin, leagueId, globalSettings });
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
    newUsersStartDisabled?: boolean;  // superadmin-only; goes to GlobalSettings, not LeagueSettings
    autoResultsEnabled?: boolean;
    autoResultsDayOfWeek?: number;
    autoResultsHourUtc?: number;
    autoResultsMinuteUtc?: number;
    autoResultsAdvanceWeek?: boolean;
    autoLockMode?: string;
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
    const adminSessForEmail = await getAdminSession();
    const leagueIdForEmail = await getAdminLeagueId(adminSessForEmail);
    const week = await prisma.week.findFirst({
      where: leagueIdForEmail
        ? { isCurrent: true, season: { leagueId: leagueIdForEmail } }
        : { isCurrent: true },
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
  if (body.autoResultsDayOfWeek !== undefined && (body.autoResultsDayOfWeek < 0 || body.autoResultsDayOfWeek > 6)) {
    return NextResponse.json({ error: "autoResultsDayOfWeek must be 0–6" }, { status: 400 });
  }
  if (body.autoResultsHourUtc !== undefined && (body.autoResultsHourUtc < 0 || body.autoResultsHourUtc > 23)) {
    return NextResponse.json({ error: "autoResultsHourUtc must be 0–23" }, { status: 400 });
  }
  if (body.autoResultsMinuteUtc !== undefined && (body.autoResultsMinuteUtc < 0 || body.autoResultsMinuteUtc > 59)) {
    return NextResponse.json({ error: "autoResultsMinuteUtc must be 0–59" }, { status: 400 });
  }
  const validAutoLockModes = ["off", "all_before_first", "thursday_split"];
  if (body.autoLockMode !== undefined && !validAutoLockModes.includes(body.autoLockMode)) {
    return NextResponse.json({ error: "autoLockMode must be 'off', 'all_before_first', or 'thursday_split'" }, { status: 400 });
  }

  // ── Global settings (superadmin only) ────────────────────────────────────────
  if (body.newUsersStartDisabled !== undefined) {
    const patchRole = await getAdminRole();
    if (patchRole !== "superadmin") {
      return NextResponse.json({ error: "Only superadmin can change this setting" }, { status: 403 });
    }
    await prisma.globalSettings.upsert({
      where: { id: "global" },
      create: { id: "global", newUsersStartDisabled: body.newUsersStartDisabled },
      update: { newUsersStartDisabled: body.newUsersStartDisabled },
    });
    const updatedGlobal = await prisma.globalSettings.findUnique({ where: { id: "global" } });
    return NextResponse.json({ globalSettings: updatedGlobal });
  }

  const adminSession = await getAdminSession();
  const leagueId = await getAdminLeagueId(adminSession);
  if (!leagueId) {
    return NextResponse.json({ error: "No league context" }, { status: 400 });
  }

  const settings = await prisma.leagueSettings.upsert({
    where: { leagueId },
    create: {
      leagueId,
      mode: body.mode ?? "live",
      testSeasonId: body.testSeasonId ?? null,
      testWeekId: body.testWeekId ?? null,
      emailRemindersEnabled: body.emailRemindersEnabled ?? false,
      reminderDayOfWeek: body.reminderDayOfWeek ?? 4,
      reminderHourUtc: body.reminderHourUtc ?? 12,
      reminderMinuteUtc: body.reminderMinuteUtc ?? 0,
      reminderOnlyUnsubmitted: body.reminderOnlyUnsubmitted ?? false,
      autoResultsEnabled: body.autoResultsEnabled ?? false,
      autoResultsDayOfWeek: body.autoResultsDayOfWeek ?? 2,
      autoResultsHourUtc: body.autoResultsHourUtc ?? 12,
      autoResultsMinuteUtc: body.autoResultsMinuteUtc ?? 0,
      autoResultsAdvanceWeek: body.autoResultsAdvanceWeek ?? false,
      autoLockMode: body.autoLockMode ?? "off",
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
      ...(body.autoResultsEnabled !== undefined && { autoResultsEnabled: body.autoResultsEnabled }),
      ...(body.autoResultsDayOfWeek !== undefined && { autoResultsDayOfWeek: body.autoResultsDayOfWeek }),
      ...(body.autoResultsHourUtc !== undefined && { autoResultsHourUtc: body.autoResultsHourUtc }),
      ...(body.autoResultsMinuteUtc !== undefined && { autoResultsMinuteUtc: body.autoResultsMinuteUtc }),
      ...(body.autoResultsAdvanceWeek !== undefined && { autoResultsAdvanceWeek: body.autoResultsAdvanceWeek }),
      ...(body.autoLockMode !== undefined && { autoLockMode: body.autoLockMode }),
    },
  });

  return NextResponse.json({ settings });
}
