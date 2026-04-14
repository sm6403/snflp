// Email templates using inline styles — email clients strip <style> blocks.

// ─── Shared helpers ───────────────────────────────────────────────────────────

function formatDeadline(date: Date): string {
  return date.toLocaleString("en-US", {
    timeZone: "America/New_York",
    weekday: "long",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  });
}

function baseLayout(title: string, bodyHtml: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>${title}</title></head>
<body style="margin:0;padding:0;background:#09090b;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#e4e4e7;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#09090b;padding:32px 16px;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:540px;">
        <!-- Header -->
        <tr>
          <td style="background:#18181b;border:1px solid #27272a;border-radius:12px 12px 0 0;padding:24px 32px;">
            <p style="margin:0;font-size:20px;font-weight:700;color:#f4f4f5;">SNFLP</p>
          </td>
        </tr>
        <!-- Body -->
        <tr>
          <td style="background:#18181b;border-left:1px solid #27272a;border-right:1px solid #27272a;padding:24px 32px;">
            ${bodyHtml}
          </td>
        </tr>
        <!-- Footer -->
        <tr>
          <td style="background:#09090b;border:1px solid #27272a;border-top:none;border-radius:0 0 12px 12px;padding:16px 32px;text-align:center;">
            <p style="margin:0;font-size:12px;color:#71717a;">
              You're receiving this because you have email reminders enabled.<br>
              <a href="{APP_URL}/settings" style="color:#818cf8;text-decoration:underline;">Manage your notification preferences</a>
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function actionButton(href: string, label: string): string {
  return `<a href="${href}" style="display:inline-block;background:#4f46e5;color:#fff;font-size:14px;font-weight:600;text-decoration:none;padding:10px 24px;border-radius:8px;">${label}</a>`;
}

// ─── Pre-lock 12h template ────────────────────────────────────────────────────

export interface PreLockTemplateInput {
  userName: string;
  weekLabel: string;
  seasonYear: number;
  lockAt: Date;
  appUrl: string;
  games: Array<{ homeTeam: string; awayTeam: string; gameTime: Date | null }>;
}

export function preLockTemplate(input: PreLockTemplateInput): { subject: string; html: string } {
  const { userName, weekLabel, seasonYear, lockAt, appUrl, games } = input;
  const subject = `⏰ Picks close in 12 hours — ${seasonYear} ${weekLabel}`;
  const deadline = formatDeadline(lockAt);

  const gameRows = games
    .map(
      (g) =>
        `<tr>
          <td style="padding:6px 0;font-size:14px;color:#a1a1aa;">${g.awayTeam} <span style="color:#52525b;">@</span> ${g.homeTeam}</td>
        </tr>`
    )
    .join("");

  const body = `
    <p style="margin:0 0 8px;font-size:18px;font-weight:700;color:#f4f4f5;">⏰ Deadline approaching</p>
    <p style="margin:0 0 20px;font-size:14px;color:#a1a1aa;">Hi ${userName}, your picks for <strong style="color:#e4e4e7;">${seasonYear} ${weekLabel}</strong> close at:</p>
    <p style="margin:0 0 20px;font-size:16px;font-weight:600;color:#f4f4f5;">${deadline}</p>
    ${
      games.length > 0
        ? `<p style="margin:0 0 8px;font-size:13px;font-weight:600;color:#71717a;text-transform:uppercase;letter-spacing:0.05em;">Games this week</p>
           <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">${gameRows}</table>`
        : ""
    }
    <p style="margin:0 0 24px;">${actionButton(`${appUrl}/picks`, "Submit Your Picks")}</p>
    <p style="margin:0;font-size:13px;color:#52525b;">Don't miss the deadline — once the first game kicks off, submissions close automatically.</p>
  `;

  const html = baseLayout(subject, body).replace("{APP_URL}", appUrl);
  return { subject, html };
}

// ─── Thursday noon template ───────────────────────────────────────────────────

export interface ThursdayTemplateInput {
  userName: string;
  weekLabel: string;
  seasonYear: number;
  appUrl: string;
}

export function thursdayTemplate(input: ThursdayTemplateInput): { subject: string; html: string } {
  const { userName, weekLabel, seasonYear, appUrl } = input;
  const subject = `🏈 ${seasonYear} ${weekLabel} picks are open`;

  const body = `
    <p style="margin:0 0 8px;font-size:18px;font-weight:700;color:#f4f4f5;">🏈 Time to make your picks!</p>
    <p style="margin:0 0 20px;font-size:14px;color:#a1a1aa;">Hi ${userName}, picks for <strong style="color:#e4e4e7;">${seasonYear} ${weekLabel}</strong> are open. Don't forget to submit before the deadline!</p>
    <p style="margin:0 0 24px;">${actionButton(`${appUrl}/picks`, "Make Your Picks")}</p>
    <p style="margin:0;font-size:13px;color:#52525b;">Good luck this week 🤞</p>
  `;

  const html = baseLayout(subject, body).replace("{APP_URL}", appUrl);
  return { subject, html };
}
