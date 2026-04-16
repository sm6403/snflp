import { NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import bcrypt from "bcryptjs";
import { createAdminSessionCookie } from "@/lib/admin-auth";
import { logAdminAction } from "@/lib/admin-log";
import { prisma } from "@/lib/prisma";

const MAX_ATTEMPTS = 5;
const LOCK_DURATION_MS = 15 * 60 * 1000; // 15 minutes

/**
 * Constant-time string comparison to prevent timing-based enumeration.
 * Falls back to false if lengths differ (length difference itself is
 * acceptable to leak since short/missing values can't be secrets).
 */
function safeStringEqual(a: string, b: string): boolean {
  try {
    return timingSafeEqual(Buffer.from(a), Buffer.from(b));
  } catch {
    return false;
  }
}

export async function POST(request: Request) {
  const { username, password } = await request.json() as { username?: string; password?: string };

  if (!username || !password) {
    return NextResponse.json({ error: "Username and password are required" }, { status: 400 });
  }

  // ── 1. Superadmin (env-var credentials, timing-safe comparison) ──────────
  const envUser = process.env.ADMIN_USER ?? "";
  const envPass = process.env.ADMIN_PASSWORD ?? "";
  if (safeStringEqual(username, envUser) && safeStringEqual(password, envPass)) {
    await logAdminAction("superadmin", "LOGIN", {});
    const response = NextResponse.json({ success: true });
    response.headers.set("Set-Cookie", createAdminSessionCookie());
    return response;
  }

  // ── 2. DB admin users ─────────────────────────────────────────────────────
  const adminUser = await prisma.adminUser.findUnique({ where: { username } });

  // Unknown username — return same error as wrong password (don't reveal existence)
  if (!adminUser) {
    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
  }

  if (adminUser.disabled) {
    return NextResponse.json({ error: "This account has been disabled" }, { status: 403 });
  }

  // Check if currently locked out
  if (adminUser.lockedUntil && adminUser.lockedUntil > new Date()) {
    const minutesLeft = Math.ceil((adminUser.lockedUntil.getTime() - Date.now()) / 60000);
    return NextResponse.json(
      { error: `Too many failed attempts. Try again in ${minutesLeft} minute${minutesLeft !== 1 ? "s" : ""}.` },
      { status: 429 }
    );
  }

  const isValid = await bcrypt.compare(password, adminUser.hashedPassword);

  if (!isValid) {
    const newAttempts = adminUser.loginAttempts + 1;
    const shouldLock = newAttempts >= MAX_ATTEMPTS;
    await prisma.adminUser.update({
      where: { id: adminUser.id },
      data: {
        loginAttempts: newAttempts,
        lockedUntil: shouldLock ? new Date(Date.now() + LOCK_DURATION_MS) : null,
      },
    });

    if (shouldLock) {
      return NextResponse.json(
        { error: "Too many failed attempts. Account locked for 15 minutes." },
        { status: 429 }
      );
    }

    const remaining = MAX_ATTEMPTS - newAttempts;
    return NextResponse.json(
      { error: `Invalid credentials. ${remaining} attempt${remaining !== 1 ? "s" : ""} remaining.` },
      { status: 401 }
    );
  }

  // Success — reset lockout state and record login
  await prisma.adminUser.update({
    where: { id: adminUser.id },
    data: { lastLoginAt: new Date(), loginAttempts: 0, lockedUntil: null },
  });
  await logAdminAction(adminUser.username, "LOGIN", {});

  const response = NextResponse.json({ success: true });
  response.headers.set("Set-Cookie", createAdminSessionCookie(adminUser.id));
  return response;
}
