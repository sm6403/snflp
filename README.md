# SNFLP — NFL Pick'em League Platform

A multi-league NFL pick'em web app. Players submit weekly game picks, track results on a live leaderboard, and compete across regular season and postseason. Supports multiple independent leagues, each managed by its own admin.

Built with **Next.js 16 (App Router)**, **React 19**, **Prisma 7**, **Neon PostgreSQL**, **Resend** (email), and **Tailwind CSS v4**.

---

## Table of Contents

- [Quick Start (Local Dev)](#quick-start-local-dev)
- [Environment Variables](#environment-variables)
- [Database Setup (Neon)](#database-setup-neon)
- [Email Setup (Resend)](#email-setup-resend)
- [Deployment (Vercel)](#deployment-vercel)
- [Superadmin Guide](#superadmin-guide)
- [User Features](#user-features)

---

## Quick Start (Local Dev)

**Prerequisites:** Node.js 20+, a Neon (or any PostgreSQL) database, a Resend account (optional for dev).

```bash
# 1. Install dependencies
npm install

# 2. Copy the example env file and fill in your values
cp .env.example .env
# Edit .env — see Environment Variables below

# 3. Run database migrations
npx prisma migrate deploy

# 4. Seed the database (loads all 32 NFL teams + a starter season)
npx prisma db seed

# 5. Start the dev server
npm run dev
```

The app will be available at [http://localhost:3000](http://localhost:3000).  
The admin panel is at [http://localhost:3000/admindash](http://localhost:3000/admindash).

---

## Environment Variables

Create a `.env` file in the project root. **Never commit this file.**

```env
# ── Database ────────────────────────────────────────────────────────────────────

# Primary connection string (pooled connection for the app at runtime)
DATABASE_URL=postgresql://...

# Direct (non-pooled) connection — used by Prisma migrations and the seed script.
# Required on Neon; for other providers you can set this to the same value as DATABASE_URL.
DIRECT_URL=postgresql://...


# ── Auth ────────────────────────────────────────────────────────────────────────

# Secret used to sign admin session cookies. Generate with:
#   openssl rand -hex 32
AUTH_SECRET=

# Superadmin credentials — used to log in to /admindash as the top-level admin.
# These are checked at runtime; they are never stored in the database.
ADMIN_USERNAME=
ADMIN_PASSWORD=


# ── Email (Resend) ───────────────────────────────────────────────────────────────

# API key from https://resend.com — required for email reminders to work.
# The app will build and run without this, but sending emails will throw an error.
RESEND_API_KEY=

# The "from" address shown on outgoing emails.
# Must be a verified domain/address in your Resend account.
# Defaults to onboarding@resend.dev (Resend's sandbox sender) if omitted.
EMAIL_FROM=picks@yourdomain.com


# ── App ─────────────────────────────────────────────────────────────────────────

# Full public URL of the deployed app — used to build links inside emails.
# No trailing slash.
APP_URL=https://yourapp.vercel.app
```

### Variable reference

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | ✅ | Pooled PostgreSQL connection string |
| `DIRECT_URL` | ✅ on Neon | Direct (non-pooled) connection for migrations |
| `AUTH_SECRET` | ✅ | 32-byte hex secret for signing admin cookies |
| `ADMIN_USERNAME` | ✅ | Superadmin login username |
| `ADMIN_PASSWORD` | ✅ | Superadmin login password |
| `RESEND_API_KEY` | Email only | Resend API key |
| `EMAIL_FROM` | Email only | Verified sender address |
| `APP_URL` | Email only | Public URL used in email links |

---

## Database Setup (Neon)

[Neon](https://neon.tech) is the recommended database provider. It offers a generous free tier and works seamlessly with Vercel.

### 1. Create a Neon project

1. Sign up at [neon.tech](https://neon.tech) and create a new project.
2. In the Neon console, open your project and go to **Connection Details**.
3. You will see two connection strings:
   - **Pooled connection** → use for `DATABASE_URL`
   - **Direct connection** → use for `DIRECT_URL`

> Neon's pooled connection goes through PgBouncer, which cannot run DDL statements (migrations). Always set `DIRECT_URL` to the direct connection string for migrations to work.

### 2. Run migrations

```bash
npx prisma migrate deploy
```

On first run this creates all tables. On subsequent deploys it applies only new migrations.

If a migration gets stuck (can happen with cold-start timeouts), the `scripts/migrate-with-retry.mjs` script handles recovery automatically — see [Deployment](#deployment-vercel).

### 3. Seed initial data

```bash
npx prisma db seed
```

This loads all 32 NFL teams into the database. It is safe to run multiple times (all operations are upserts). You only need to run this once.

### Other PostgreSQL providers

The app works with any PostgreSQL provider. If you are not using Neon, you can set `DIRECT_URL` to the same value as `DATABASE_URL`. Remove the `DIRECT_URL` reference from `prisma.config.ts` if your provider does not support direct connections.

---

## Email Setup (Resend)

Weekly pick reminders are sent via [Resend](https://resend.com).

1. Create a free account at [resend.com](https://resend.com).
2. Add and verify your sending domain (or use `onboarding@resend.dev` for testing).
3. Create an API key and add it to `RESEND_API_KEY`.
4. Set `EMAIL_FROM` to a verified sender address, e.g. `picks@yourdomain.com`.

Email sending is optional — the app runs fine without it. If `RESEND_API_KEY` is missing, emails will fail at runtime but the rest of the app is unaffected.

Email reminders are configured per-league from the **Settings** page in the admin panel. You can send a test email from there to verify your configuration before enabling it for users.

---

## Deployment (Vercel)

### First deploy

1. Push the repository to GitHub.
2. Import the project in [Vercel](https://vercel.com).
3. Add all environment variables listed above in **Project → Settings → Environment Variables**.
4. Deploy.

Vercel runs the build command from `vercel.json`:

```
node scripts/migrate-with-retry.mjs && next build
```

This runs database migrations automatically on every deploy before the build starts.

### Subsequent deploys

Push to `master` (or your production branch). Vercel picks up the push and runs migrations + build automatically.

### Migration recovery

If a deployment fails mid-migration (e.g. due to a Neon cold-start timeout), the `migrate-with-retry.mjs` script detects the stuck migration and clears it before retrying. It will make up to 5 attempts with a 5-second delay between each. No manual intervention is normally needed.

If you ever need to intervene manually, run this in the Neon SQL editor:

```sql
UPDATE _prisma_migrations
SET rolled_back_at = NOW()
WHERE rolled_back_at IS NULL
  AND applied_steps_count = 0;
```

Then re-deploy.

---

## Superadmin Guide

The superadmin account is the top-level administrator. It is configured via environment variables (`ADMIN_USERNAME` / `ADMIN_PASSWORD`) and has access to features that league-level admins do not.

Log in at `/admindash`.

---

### Leagues

**Dashboard → Leagues**

This is where you set up the structure of the platform. Each league is a fully independent instance with its own seasons, users, settings, and admin accounts.

#### Creating a league

1. Click **+ New League**.
2. Give the league a name.
3. An invite code is generated automatically (6 characters, e.g. `HAWKS4`). Share this with users so they can join the league from their dashboard.

#### Invite codes

Each league has a unique invite code. Users enter this code on their dashboard to join. You can regenerate a code at any time (the old code immediately stops working).

You can toggle **Require approval** on a league. When enabled, users who enter the invite code are placed in a pending queue rather than joining immediately. The league admin then approves or rejects each request from the Users page.

---

### Admin Accounts

**Dashboard → (Users page, scroll down)**

League admins are separate accounts from the superadmin. Each admin is tied to exactly one league and can only see and manage that league's data.

#### Creating an admin

1. Scroll to **Admin Accounts** at the bottom of the Users page.
2. Click **+ Add Admin**.
3. Enter a username, password (minimum 8 characters), and select the league.
4. Click **Create Admin**.

The new admin can log in at `/admindash` with those credentials. They will see only their league's seasons, users, and settings.

#### Managing admins

- **Enable / Disable** — disabling an admin prevents them from logging in without deleting their account.
- **Change Password** — inline password reset without needing to know the current password.
- **League assignment** — use the dropdown on the admin row to reassign an admin to a different league.
- **Remove** — permanently deletes the admin account. The league and its data are unaffected.

> The superadmin password cannot be changed from the UI — update `ADMIN_PASSWORD` in your environment variables and redeploy.

---

### Seasons

**Dashboard → Seasons**

Seasons hold the weeks and games that users pick against.

#### Creating a season

1. Click **+ New Season**.
2. Set the year and type (Regular or Postseason).
3. Configure rules for this season:
   - **Timed auto-locking** — games lock automatically at kick-off time.
   - **Favourite team bonus win** — users get a bonus for correctly picking their favourite team.
   - **Last Man Standing (LMS)** — enables the LMS game mode alongside regular picks.

Seasons are scoped to their league and are not visible across leagues.

#### Weeks

Each season contains weeks. Weeks hold individual games and track pick submissions.

- **Current week** — only one week per season can be current at a time. This is the week users are picking against.
- **Lock week** — prevents new pick submissions. Can be done manually (instant or scheduled) or automatically via Kickoff Auto-Lock (see [Settings](#settings)).
- **Game-level locking** — the Admin Picks page has buttons to lock only the Thursday game(s), lock all games at once, or unlock all games individually without affecting the overall week lock state.
- **Confirm results** — after games finish, enter results to score all picks and update the leaderboard.

#### Importing schedules from ESPN

In the week editor (**Seasons → [season] → [week]**), click **⬇ Import from ESPN** to automatically pull that week's matchups and kick-off times from ESPN's public scoreboard API. A preview panel shows the fetched games before anything is written — click **Apply to Schedule** to populate the game rows, or **Discard** to cancel.

This uses ESPN's unofficial public API (no account or API key required). The 2025 regular season and all prior seasons are available. The 2026 schedule will become available once ESPN publishes it.

> Game times are in UTC. The import fills the schedule editor rows exactly as if you had entered them manually — you can still edit individual games before saving.

#### Importing results from ESPN

Once a week is locked and the **Enter Results** panel is open, click **⬇ Import Results from ESPN** to automatically fill in all final scores. Winners are determined by comparing ESPN's final scores; equal scores are marked as ties. Games that haven't finished yet are skipped, so partial imports work correctly during a live game day.

After importing you can still override any individual game result before clicking **Publish All Results**.

---

### Users

**Dashboard → (main page)**

All registered user accounts in the current admin's league.

#### User table

The table shows active users. Disabled accounts are collapsed into a **Disabled accounts** section at the bottom — click it to expand.

- **Enable / Disable** — toggles whether a user can log in.
- **Leaderboard toggle** — hides a user from the public leaderboard without disabling their account.
- **Manage** — opens the full user management page where you can edit name, alias, email, favourite team, and league membership.

#### Moving a user between leagues

On the **Manage** page, the **League** section (visible to superadmins only when more than one league exists) lets you move a user to a different league. This removes them from their current league and adds them to the target league.

#### New account registration

By default, newly registered accounts are active and can log in immediately. You can change this behaviour in **Settings → New Account Registration**. When enabled, new sign-ups start disabled and must be manually activated from the Users page.

---

### Settings

**Dashboard → Settings**

Settings are per-league. Superadmins see all options; league admins see only their league's settings.

#### App Mode

- **Live** — users see the current active week.
- **Test** — users see a specific week chosen by the admin. Useful for previewing a new week's layout before making it current.

#### New Account Registration

Toggle whether new sign-ups start as disabled (must be manually activated) or active (can log in immediately). See [Users](#users) above.

> This is a **superadmin-only, global setting** — it applies across all leagues simultaneously and is only visible when logged in as the superadmin.

#### Favourite Team Picks

Bulk lock or unlock all users' ability to change their favourite team. Locked users see a 🔒 badge on their team picker.

#### Kickoff Auto-Lock

Controls whether picks are locked automatically based on game kick-off times, without needing to press the manual lock button.

Three modes are available:

- **Off** — picks are only locked manually (instant lock button or scheduled lock time). This is the default.
- **Lock Before First Kickoff** — all picks for the week lock 5 minutes before the earliest game kick-off.
- **Thursday Split** — Thursday game picks lock 5 minutes before Thursday's kick-off; all remaining picks lock 5 minutes before the first Sunday game. This allows users to still submit Sunday picks after the Thursday game has started.

The auto-lock cron runs every minute. Manual locks (`lockAt` scheduled time or the instant Lock Week button) always take precedence — if either is set, auto-lock skips that week.

**Favourite team auto-fill:** When Thursday games lock and a user hasn't submitted picks yet, if their favourite team is playing in a Thursday game their pick for that game is automatically filled with their favourite team. This means the existing favourite team bonus still applies to their Thursday game even if they missed the deadline.

**Game-level lock buttons** on the Admin Picks page provide manual control without relying on timers:

- **Lock Thursday Night** — immediately locks the Thursday game(s) and creates any missed picks.
- **Lock All Games** — locks all remaining games and closes the week.
- **Unlock All Games** — clears all game-level locks (useful for testing or corrections).

Users see a lock time label on both the picks page header and the dashboard widget so they know when their picks will close. After Thursday games lock, a "Thursday picks locked" note appears on the dashboard next to the Go to Picks button.

#### Email Reminders

- **Master toggle** — enables or disables reminder emails for the entire league.
- **Schedule** — set the day of the week and UTC time when the weekly reminder is sent.
- **Only unsubmitted** — when on, only users who haven't locked in picks yet will receive the reminder email.
- **Send a test email** — verify your email configuration by sending a test email to any address.

---

### Activity Log

**Dashboard → Activity**

A chronological log of all admin actions — week locks, result confirmations, pick edits, user changes, and more. Useful for auditing.

---

## User Features

### Registration & Sign-in

Users register at `/signup` with a name, email address, and password. Once signed in they land on the dashboard. If the league admin has enabled **New Account Registration approval**, new accounts start disabled and must be activated by the admin before the user can access the app.

To join a league, users enter the 6-character invite code shared by the admin. If the league requires approval, a "Request Pending" message is shown until the admin approves.

---

### Dashboard

The dashboard is the home screen after sign-in. It shows:

- **Weekly Picks card** — the current week label and submission status. Status pills indicate whether picks are waiting, submitted, unlocked by an admin, or closed. A lock time label shows when picks will close (e.g. "Locks Thu, Sep 5 at 8:15 PM") when a scheduled or auto-lock is set. A "Thursday picks locked" note appears next to the Go to Picks button when Thursday games have kicked off but Sunday picks are still open.
- **Season stats** — overall correct/wrong counts, percentage, and best week, updated as results are confirmed.
- **Season rules** — a summary of which rules are active for the current season (favourite team bonus, timed locking, Last Man Standing).
- **Favourite team picker** — set or change your favourite NFL team. Used for pick pre-selection and the bonus win rule. Admins can lock this to prevent changes mid-season.
- **Week history** — a list of all weeks in the season with scores for confirmed weeks and links to view picks or results.

---

### Weekly Picks (`/picks`)

The main picking interface. Users select one team per game for every matchup in the current week, then submit.

#### Picking

- Each game shows the away team and home team as selectable buttons with the team logo, abbreviation, and current season record (W-L-T).
- If the user has a favourite team set, their team's game is pre-selected with a yellow border and ⭐ icon. They can override this before submitting.
- **Recent form strips** — each team button shows a strip of recent results (colour-coded rings: green win, red loss, amber draw, grey BYE) so users can assess form at a glance.
- Picks can be changed freely until submitted. Once submitted and locked, they cannot be changed unless an admin unlocks them.

#### Layouts

A toggle in the header switches between two layouts, with the preference saved in the browser:

- **Full** — large cards with centred logos and clear labels. Best on desktop.
- **Compact** — single-row layout with smaller logos. Better on mobile or when there are many games.

#### Locking

Games can be locked in several ways. Once a game is locked, the buttons are disabled and the game shows an ⏰ badge.

- **Timed auto-locking** — individual games lock at their kick-off time.
- **Kickoff auto-lock** (league setting) — all picks, or just Thursday picks, lock automatically before kick-off (see [Kickoff Auto-Lock](#kickoff-auto-lock)).
- **Manual lock** — admin locks the week instantly or via a scheduled time.

An auto-lock countdown banner appears above the games when a timed lock is approaching.

The submit button is disabled until all unlocked games have a selection. If some games are already locked, only the remaining open games need to be picked.

#### Results view

Once the admin confirms results, each game card updates to show the winner. The user's picks are graded:

- **Green** — correct pick.
- **Red** — wrong pick.
- **Amber** — draw (both teams credited).
- **Purple** — favourite team bonus win (rule must be enabled): the user picked their favourite team and it lost, but the pick still counts as correct.

A score summary at the top shows the overall result (e.g. "12 / 14 correct — 86%").

#### Historical picks (`/picks/[weekId]`)

Any past week can be viewed at its own URL. The same interface is shown in read-only mode. Picks from users who haven't submitted show a "You didn't submit picks for this week" message. Admins can share a link with `?userId=` to view another player's picks.

---

### Leaderboard (`/leaderboard`)

The leaderboard has three tabs.

#### Season tab

The full-season standings table ranked by correct picks. Shows each player's correct/graded count, percentage (colour-coded green/yellow/red), and position change since the previous confirmed week (↑ / ↓ / —).

A multi-week rank chart plots each player's position over the season. The current user's line is highlighted.

If the season uses divisions, a toggle switches between the overall standings and a divisions view that re-ranks players within their division.

#### Weekly tab

Pick a specific confirmed week from the dropdown to see that week's standalone rankings. Same table and divisions toggle as the season tab.

#### Last Man Standing tab

Only visible when the LMS rule is enabled. Shows each player's weekly team picks as a row of logos with colour-coded results (green win, red loss, amber pending, grey missed). Eliminated players are labelled with the week they went out. Active players are ranked above eliminated ones.

---

### Last Man Standing (LMS)

When the LMS rule is enabled for a season, an extra pick section appears below the regular game picks on the picks page.

- Each week, pick one NFL team to win their game.
- You cannot reuse a team you have already picked earlier in the season (previously used teams are shown greyed out).
- Teams on a BYE week are unavailable.
- If your picked team loses or ties, you are eliminated.
- The LMS leaderboard tab tracks everyone's picks and shows who is still active.

---

### Settings (`/settings`)

The settings page lets users manage their account:

- **Display name (alias)** — the name shown on leaderboards. Separate from the account name used at sign-up.
- **Email address** — update the login email.
- **Password** — change password (requires current password; new password minimum 8 characters).
- **Email reminders** — opt in or out of the weekly reminder email sent before the picks deadline.
- **Team Colour Theme** — apply your favourite team's official colours as the app accent. All accent elements (buttons, toggles, nav active states, focus rings) shift to the team's primary colour. The theme is stored per-user and applied server-side via a cookie so there is no colour flash on page load. All 32 NFL teams are supported, with dark-background-safe colour choices for teams with very dark primaries. Click **Reset Theme** to return to the default indigo accent.
