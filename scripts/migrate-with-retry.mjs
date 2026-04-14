/**
 * Runs `prisma migrate deploy` with retries.
 *
 * Before each attempt, connects directly to Postgres and releases any
 * stuck Prisma advisory lock (lock ID 72707369 = pg_advisory_lock hash
 * of "prisma_migrate"). This prevents P1002 timeouts caused by a
 * previous deployment dying mid-migration and leaving the lock held.
 */
import { execSync } from "child_process";
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
    // Terminate any backend session that holds the Prisma advisory lock
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
    // Non-fatal — log and continue; the migration will handle its own errors
    console.warn("[migrate] Could not release advisory lock:", err.message);
  } finally {
    await client.end();
  }
}

for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
  console.log(`[migrate] Attempt ${attempt}/${MAX_ATTEMPTS}…`);
  await releaseLock();

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
