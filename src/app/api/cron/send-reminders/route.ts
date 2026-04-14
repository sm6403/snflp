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
//   2. Thursday noon: sends at 12:00 UTC (= 08:00 ET winter / 08:00 ET summer varies — adjust if needed)
//
// Deduplication: NotificationLog has @@unique([userId, weekId, type]) so duplicate cron
// invocations within the same window are silently rejected by the DB constraint.
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

    // Query eligible users: active, opted-in, not yet sent
    const users = await prisma.user.findMany({
      where: {
        disabled: false,
        emailReminders: true,
        ...(alreadySentIds.length > 0 && { id: { notIn: alreadySentIds } }),
      },
      select: { id: true, email: true, alias: true, name: true },
    });

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

  // ── Trigger 2: Thursday noon UTC ──────────────────────────────────────────────
  // getUTCDay() === 4 is Thursday; getUTCHours() === 12 is noon UTC (08:00 ET winter).
  // Change 12 → 16 if you want noon ET (summer/winter ET is UTC-4/UTC-5).
  if (now.getUTCDay() === 4 && now.getUTCHours() === 12) {
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
