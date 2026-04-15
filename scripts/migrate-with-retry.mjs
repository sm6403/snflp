/**
 * Runs `prisma migrate deploy` with retries.
 *
 * Before each attempt:
 *   1. Releases any stuck Prisma advisory lock (prevents P1002 timeouts).
 *   2. Resolves any failed migrations (P3009) by marking them as rolled back,
 *      so they can be cleanly re-applied on the next attempt.
 *
 * A migration can get stuck in "failed" state when a previous deployment ran
 * a migration that errored mid-way (e.g. a unique constraint violation during
 * a backfill). Prisma wraps migrations in transactions, so no partial changes
 * are left in the DB — it's safe to mark the migration as rolled-back and
 * re-run it with the corrected SQL.
 */
import { execSync, execFileSync } from "child_process";
import pg from "pg";

const MAX_ATTEMPTS = 5;
const DELAY_MS = 5000;
const PRISMA_LOCK_ID = 72707369n; // BigInt to match pg advisory lock type

const connStr = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
if (!connStr) {
  console.error("[migrate] No DATABASE_URL or DIRECT_URL set.");
  process.exit(1);
}

async function releaseLock() {
  const client = new pg.Client({ connectionString: connStr });
  try {
    await client.connect();
    const res = await client.query(
      `SELECT pg_terminate_backend(pid)
       FROM pg_locks
       WHERE locktype = 'advisory'
         AND objid = $1`,
      [PRISMA_LOCK_ID]
    );
    if (res.rowCount > 0) {
      console.log(`[migrate] Released stuck advisory lock (${res.rowCount} session(s) terminated).`);
    }
  } catch (err) {
    console.warn("[migrate] Could not release advisory lock:", err.message);
  } finally {
    await client.end();
  }
}

/**
 * Finds any migrations marked as failed in _prisma_migrations and resolves
 * them as rolled-back so prisma migrate deploy can re-apply them.
 *
 * Prisma v7 marks a failed migration with: finished_at IS NOT NULL,
 * applied_steps_count = 0, rolled_back_at IS NULL. Note: `logs` may be NULL
 * even on failure in Prisma v7, so we do NOT filter on logs.
 *
 * The migration SQL is written idempotently (IF NOT EXISTS guards), so it is
 * safe to re-apply even if a previous attempt partially committed DDL through
 * Neon's connection pooler.
 */
async function resolveFailedMigrations() {
  const client = new pg.Client({ connectionString: connStr });
  try {
    await client.connect();

    // Check that the migrations table exists (it won't on a brand-new DB)
    const tableCheck = await client.query(
      `SELECT 1 FROM information_schema.tables
       WHERE table_schema = 'public' AND table_name = '_prisma_migrations'`
    );
    if (tableCheck.rowCount === 0) return;

    // applied_steps_count = 0 with a finished_at is Prisma's "failed" state
    const res = await client.query(
      `SELECT migration_name
       FROM _prisma_migrations
       WHERE finished_at IS NOT NULL
         AND rolled_back_at IS NULL
         AND applied_steps_count = 0`
    );

    if (res.rowCount > 0) {
      console.log(`[migrate] Found ${res.rowCount} failed migration(s) — resolving as rolled-back…`);
    }

    for (const row of res.rows) {
      const name = row.migration_name;
      console.log(`[migrate] Resolving: ${name}`);
      try {
        execSync(`npx prisma migrate resolve --rolled-back "${name}"`, { stdio: "inherit" });
      } catch (err) {
        console.warn(`[migrate] Could not resolve migration ${name}:`, err.message);
      }
    }
  } catch (err) {
    console.warn("[migrate] Could not check for failed migrations:", err.message);
  } finally {
    await client.end();
  }
}

for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
  console.log(`[migrate] Attempt ${attempt}/${MAX_ATTEMPTS}…`);
  await releaseLock();
  await resolveFailedMigrations();

  try {
    execSync("npx prisma migrate deploy", { stdio: "inherit" });
    console.log("[migrate] Done.");
    process.exit(0);
  } catch {
    if (attempt === MAX_ATTEMPTS) {
      console.error("[migrate] All attempts failed.");
      process.exit(1);
    }
    console.log(`[migrate] Failed. Retrying in ${DELAY_MS / 1000}s…`);
    await new Promise((r) => setTimeout(r, DELAY_MS));
  }
}
