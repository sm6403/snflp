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
- **Lock week** — prevents new pick submissions. Can be done manually or automatically (with timed auto-locking).
- **Confirm results** — after games finish, enter results to score all picks and update the leaderboard.

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

#### Favourite Team Picks

Bulk lock or unlock all users' ability to change their favourite team. Locked users see a 🔒 badge on their team picker.

#### Email Reminders

- **Master toggle** — enables or disables reminder emails for the entire league.
- **Schedule** — set the day of the week and UTC time when the weekly reminder is sent.
- **Only unsubmitted** — when on, only users who haven't locked in picks yet will receive the reminder email.
- **Send a test email** — verify your email configuration by sending a test email to any address.

---

### Activity Log

**Dashboard → Activity**

A chronological log of all admin actions — week locks, result confirmations, pick edits, user changes, and more. Useful for auditing.
