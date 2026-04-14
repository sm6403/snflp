import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email";
import { preLockTemplate, thursdayTemplate } from "@/lib/email-templates";

// GET /api/cron/send-reminders
// Called every 15 minutes by cron-job.org (Vercel Hobby plan only supports once-daily crons).
// Protected by CRON_SECRET env var (passed as ?secret=... or Authorization: Bearer header).
//
// Triggers:
//   1. Pre-lock: sends 12h before week.lockAt (20-min window to tolerate cold starts)
//   2. Scheduled weekly reminder: fires on the admin-configured day + UTC time
//      (20-min window; @@unique on NotificationLog prevents double-sends)
//
// The "thursday_noon" type name is kept for existing log rows even though the
// schedule is now configurable — new rows still use the same type key.
export async function GET(request: Request) {
  // ── Auth ─────────────────────────────────────────────────────────────────────
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const { searchParams } = new URL(request.url);
    const headerSecret = request.headers.get("authorization")?.replace("Bearer ", "");
    const querySecret = searchParams.get("secret");
    if (headerSecret !== cronSecret && querySecret !== cronSecret) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  // ── Admin kill switch ─────────────────────────────────────────────────────────
  const appSettings = await prisma.appSettings.findFirst();
  if (!appSettings?.emailRemindersEnabled) {
    return NextResponse.json({ skipped: true, reason: "emailRemindersEnabled is false" });
  }

  const {
    reminderDayOfWeek,
    reminderHourUtc,
    reminderMinuteUtc,
    reminderOnlyUnsubmitted,
  } = appSettings;

  const appUrl = (process.env.APP_URL ?? "").replace(/\/$/, "");
  const now = new Date();
  const results: Array<{ type: string; sent: number; errors: number }> = [];

  // ── Load current week ─────────────────────────────────────────────────────────
  const week = await prisma.week.findFirst({
    where: { isCurrent: true },
    include: {
      season: { select: { year: true } },
      games: {
        select: {
          gameTime: true,
          homeTeam: { select: { name: true } },
          awayTeam: { select: { name: true } },
        },
        orderBy: { gameTime: "asc" },
      },
    },
  });

  if (!week) {
    return NextResponse.json({ skipped: true, reason: "No current week" });
  }

  // ── Helper: build eligible user list ─────────────────────────────────────────
  async function getEligibleUsers(alreadySentIds: string[]) {
    // Base filter: active + opted-in + not already notified this week+type
    const baseWhere = {
      disabled: false,
      emailReminders: true,
      ...(alreadySentIds.length > 0 && { id: { notIn: alreadySentIds } }),
    };

    if (!reminderOnlyUnsubmitted) {
      return prisma.user.findMany({
        where: baseWhere,
        select: { id: true, email: true, alias: true, name: true },
      });
    }

    // "Only unsubmitted" mode: exclude users who have already locked their picks
    const submittedUserIds = (
      await prisma.pickSet.findMany({
        where: { weekId: week!.id, lockedAt: { not: null } },
        select: { userId: true },
      })
    ).map((p) => p.userId);

    return prisma.user.findMany({
      where: {
        ...baseWhere,
        ...(submittedUserIds.length > 0 && {
          id: {
            notIn: [
              ...(alreadySentIds.length > 0 ? alreadySentIds : []),
              ...submittedUserIds,
            ],
          },
        }),
      },
      select: { id: true, email: true, alias: true, name: true },
    });
  }

  // ── Helper: send to eligible users ────────────────────────────────────────────
  async function sendToEligibleUsers(
    type: "pre_lock_12h" | "thursday_noon",
    buildEmail: (user: { id: string; email: string; alias: string | null; name: string | null }) => { subject: string; html: string }
  ) {
    // Find user IDs already notified for this week+type
    const alreadySent = await prisma.notificationLog.findMany({
      where: { weekId: week!.id, type },
      select: { userId: true },
    });
    const alreadySentIds = alreadySent.map((l) => l.userId);

    const users = await getEligibleUsers(alreadySentIds);

    let sent = 0;
    let errors = 0;

    for (const user of users) {
      try {
        const { subject, html } = buildEmail(user);
        await sendEmail({ to: user.email, subject, html });
        await prisma.notificationLog.create({
          data: { userId: user.id, weekId: week!.id, type },
        });
        sent++;
      } catch (err) {
        // Per-user failure should not abort remaining sends
        console.error(`[send-reminders] Failed to send ${type} to ${user.email}:`, err);
        errors++;
      }
    }

    results.push({ type, sent, errors });
  }

  // ── Trigger 1: Pre-lock 12h ───────────────────────────────────────────────────
  if (week.lockAt) {
    const preLockTime = new Date(week.lockAt.getTime() - 12 * 60 * 60 * 1000);
    const windowEnd = new Date(preLockTime.getTime() + 20 * 60 * 1000); // 20-min window
    if (now >= preLockTime && now <= windowEnd) {
      await sendToEligibleUsers("pre_lock_12h", (user) => {
        const userName = user.alias ?? user.name ?? user.email;
        return preLockTemplate({
          userName,
          weekLabel: week.label,
          seasonYear: week.season.year,
          lockAt: week.lockAt!,
          appUrl,
          games: week.games.map((g) => ({
            homeTeam: g.homeTeam.name,
            awayTeam: g.awayTeam.name,
            gameTime: g.gameTime,
          })),
        });
      });
    }
  }

  // ── Trigger 2: Admin-configured weekly scheduled reminder ─────────────────────
  // Check: correct day-of-week, correct hour, and within the 20-min window after
  // the configured minute (cron fires every 15 min so this always catches one slot).
  const targetMinuteMs =
    new Date(
      Date.UTC(
        now.getUTCFullYear(),
        now.getUTCMonth(),
        now.getUTCDate(),
        reminderHourUtc,
        reminderMinuteUtc,
        0
      )
    ).getTime();
  const windowEndMs = targetMinuteMs + 20 * 60 * 1000;

  if (
    now.getUTCDay() === reminderDayOfWeek &&
    now.getTime() >= targetMinuteMs &&
    now.getTime() <= windowEndMs
  ) {
    await sendToEligibleUsers("thursday_noon", (user) => {
      const userName = user.alias ?? user.name ?? user.email;
      return thursdayTemplate({
        userName,
        weekLabel: week.label,
        seasonYear: week.season.year,
        appUrl,
      });
    });
  }

  return NextResponse.json({ results });
}
