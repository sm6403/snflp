import { cookies } from "next/headers";
import { createHmac, timingSafeEqual } from "crypto";
import { prisma } from "@/lib/prisma";

const COOKIE_NAME = "admin_session";

function getSecret() {
  return process.env.AUTH_SECRET!;
}

function sign(value: string): string {
  return createHmac("sha256", getSecret()).update(value).digest("hex");
}

/**
 * Creates the Set-Cookie header value for an admin session.
 * Pass adminId for a DB admin user, omit for the superadmin.
 */
const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";

export function createAdminSessionCookie(adminId?: string): string {
  const token = adminId ? `admin:user:${adminId}` : "admin:superadmin";
  const signature = sign(token);
  const cookieValue = `${token}.${signature}`;
  return `${COOKIE_NAME}=${cookieValue}; Path=/; HttpOnly; SameSite=Lax; Max-Age=86400${secure}`;
}

export function clearAdminSessionCookie(): string {
  return `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure}`;
}

type AdminRole = "superadmin" | "admin" | null;

export type AdminSession =
  | { role: "superadmin"; leagueId: null; adminName: "superadmin" }
  | { role: "admin"; leagueId: string; adminId: string; adminName: string }
  | null;

/**
 * Verify the admin cookie and extract the token.
 * Returns { token } on success, or null.
 */
async function extractAdminToken(): Promise<string | null> {
  const cookieStore = await cookies();
  const cookie = cookieStore.get(COOKIE_NAME);
  if (!cookie?.value) return null;

  const lastDot = cookie.value.lastIndexOf(".");
  if (lastDot === -1) return null;

  const token = cookie.value.slice(0, lastDot);
  const signature = cookie.value.slice(lastDot + 1);

  const expected = sign(token);
  try {
    const valid = timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
    if (!valid) return null;
  } catch {
    return null;
  }

  return token;
}

/**
 * Returns the full admin session including leagueId:
 *   superadmin → { role: "superadmin", leagueId: null, adminName: "superadmin" }
 *   DB admin  → { role: "admin", leagueId, adminId, adminName }
 *   invalid   → null
 */
export async function getAdminSession(): Promise<AdminSession> {
  const token = await extractAdminToken();
  if (!token) return null;

  if (token === "admin:superadmin" || token === "admin:authenticated") {
    return { role: "superadmin", leagueId: null, adminName: "superadmin" };
  }

  if (token.startsWith("admin:user:")) {
    const adminId = token.slice("admin:user:".length);
    const adminUser = await prisma.adminUser.findUnique({
      where: { id: adminId },
      select: { id: true, username: true, leagueId: true },
    });
    if (!adminUser) return null;
    return {
      role: "admin",
      leagueId: adminUser.leagueId,
      adminId: adminUser.id,
      adminName: adminUser.username,
    };
  }

  return null;
}

/**
 * Returns the role of the current admin session:
 *   "superadmin" – env-var credentials (or legacy "admin:authenticated" cookie)
 *   "admin"      – a DB-backed AdminUser account
 *   null         – unauthenticated or invalid session
 */
export async function getAdminRole(): Promise<AdminRole> {
  const session = await getAdminSession();
  return session?.role ?? null;
}

/** Returns true if the request has any valid admin session (superadmin or DB admin). */
export async function verifyAdminSession(): Promise<boolean> {
  return (await getAdminRole()) !== null;
}

/** Returns true only for the superadmin (env-var credentials). */
export async function verifyIsSuperAdmin(): Promise<boolean> {
  return (await getAdminRole()) === "superadmin";
}

/**
 * Returns the display name of the current admin session:
 *   "superadmin" for env-var credentials
 *   The admin's username for DB admin users
 *   null if not authenticated
 */
export async function getAdminName(): Promise<string | null> {
  const session = await getAdminSession();
  return session?.adminName ?? null;
}
