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
 * Finds any migrations marked as failed in _prisma_migrations and marks them
 * as rolled-back DIRECTLY via SQL (equivalent to `prisma migrate resolve
 * --rolled-back` but bypasses Prisma CLI subprocess issues).
 *
 * Prisma considers a migration "failed" (P3009) when:
 *   finished_at IS NOT NULL AND rolled_back_at IS NULL AND applied_steps_count = 0
 *
 * Setting rolled_back_at unblocks `migrate deploy` so it can re-apply the
 * migration with the corrected (idempotent) SQL.
 */
async function resolveFailedMigrations() {
  const client = new pg.Client({ connectionString: connStr });
  try {
    await client.connect();
    console.log("[migrate] Checking for failed migrations…");

    // Check that the migrations table exists (it won't on a brand-new DB)
    const tableCheck = await client.query(
      `SELECT 1 FROM information_schema.tables
       WHERE table_schema = 'public' AND table_name = '_prisma_migrations'`
    );
    if (tableCheck.rowCount === 0) {
      console.log("[migrate] _prisma_migrations table not found — skipping.");
      return;
    }

    // Show current state for debugging
    const allRows = await client.query(
      `SELECT migration_name, applied_steps_count, finished_at IS NOT NULL as finished,
              rolled_back_at IS NOT NULL as rolled_back
       FROM _prisma_migrations
       ORDER BY started_at DESC LIMIT 5`
    );
    console.log("[migrate] Recent migrations:", JSON.stringify(allRows.rows));

    // Mark stuck/failed migrations as rolled-back directly in the table.
    // This is exactly what `prisma migrate resolve --rolled-back` does internally.
    //
    // Two failure modes:
    //   1. Started but never finished (finished_at IS NULL, applied_steps_count = 0)
    //      — process was killed mid-migration (Neon cold-start, build timeout, etc.)
    //   2. Finished with error (finished_at IS NOT NULL, applied_steps_count = 0)
    //      — migration ran but failed (constraint violation, etc.)
    //
    // In both cases, applied_steps_count = 0 and rolled_back_at IS NULL is the signal.
    const res = await client.query(
      `UPDATE _prisma_migrations
       SET rolled_back_at = NOW()
       WHERE rolled_back_at IS NULL
         AND applied_steps_count = 0
       RETURNING migration_name`
    );

    if (res.rowCount > 0) {
      console.log(`[migrate] Marked ${res.rowCount} failed migration(s) as rolled-back:`);
      for (const row of res.rows) {
        console.log(`  - ${row.migration_name}`);
      }
    } else {
      console.log("[migrate] No failed migrations found.");
    }
  } catch (err) {
    console.warn("[migrate] Could not resolve failed migrations:", err.message);
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
