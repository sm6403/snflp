/**
 * Runs `prisma migrate deploy` with retries to handle Neon cold-start
 * timeouts (P1002 - advisory lock acquisition fails on a sleeping DB).
 */
import { execSync } from "child_process";

const MAX_ATTEMPTS = 5;
const DELAY_MS = 8000;

for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
  try {
    console.log(`[migrate] Attempt ${attempt}/${MAX_ATTEMPTS}…`);
    execSync("npx prisma migrate deploy", { stdio: "inherit" });
    console.log("[migrate] Done.");
    process.exit(0);
  } catch (err) {
    if (attempt === MAX_ATTEMPTS) {
      console.error("[migrate] All attempts failed.");
      process.exit(1);
    }
    console.log(`[migrate] Failed (attempt ${attempt}). Retrying in ${DELAY_MS / 1000}s…`);
    await new Promise((r) => setTimeout(r, DELAY_MS));
  }
}
