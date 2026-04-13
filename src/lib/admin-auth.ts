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
export function createAdminSessionCookie(adminId?: string): string {
  const token = adminId ? `admin:user:${adminId}` : "admin:superadmin";
  const signature = sign(token);
  const cookieValue = `${token}.${signature}`;
  return `${COOKIE_NAME}=${cookieValue}; Path=/; HttpOnly; SameSite=Lax; Max-Age=86400`;
}

export function clearAdminSessionCookie(): string {
  return `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
}

type AdminRole = "superadmin" | "admin" | null;

/**
 * Returns the role of the current admin session:
 *   "superadmin" – env-var credentials (or legacy "admin:authenticated" cookie)
 *   "admin"      – a DB-backed AdminUser account
 *   null         – unauthenticated or invalid session
 */
export async function getAdminRole(): Promise<AdminRole> {
  const cookieStore = await cookies();
  const cookie = cookieStore.get(COOKIE_NAME);
  if (!cookie?.value) return null;

  const lastDot = cookie.value.lastIndexOf(".");
  if (lastDot === -1) return null;

  const token = cookie.value.slice(0, lastDot);
  const signature = cookie.value.slice(lastDot + 1);

  // Verify HMAC signature — proves the cookie was issued by this server
  const expected = sign(token);
  try {
    const valid = timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
    if (!valid) return null;
  } catch {
    return null;
  }

  // Superadmin token (also accept legacy "admin:authenticated" for existing sessions)
  if (token === "admin:superadmin" || token === "admin:authenticated") {
    return "superadmin";
  }

  // DB admin token: "admin:user:{adminId}"
  if (token.startsWith("admin:user:")) {
    const adminId = token.slice("admin:user:".length);
    const adminUser = await prisma.adminUser.findUnique({
      where: { id: adminId },
      select: { id: true },
    });
    return adminUser ? "admin" : null;
  }

  return null;
}

/** Returns true if the request has any valid admin session (superadmin or DB admin). */
export async function verifyAdminSession(): Promise<boolean> {
  return (await getAdminRole()) !== null;
}

/** Returns true only for the superadmin (env-var credentials). */
export async function verifyIsSuperAdmin(): Promise<boolean> {
  return (await getAdminRole()) === "superadmin";
}
