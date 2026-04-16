import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";

const USER_LEAGUE_COOKIE = "active_league";
const ADMIN_LEAGUE_COOKIE = "admin_league_context";

// ─── User-facing ─────────────────────────────────────────────────────────────

/** Read the active league ID from the user's cookie. */
export async function getUserLeagueId(): Promise<string | null> {
  const cookieStore = await cookies();
  return cookieStore.get(USER_LEAGUE_COOKIE)?.value ?? null;
}

/**
 * Validate that the authenticated user belongs to the given league.
 * Returns the leagueId on success, throws on failure.
 */
export async function requireUserLeague(userId: string): Promise<string> {
  const leagueId = await getUserLeagueId();
  if (!leagueId) throw new Error("No league selected");

  const membership = await prisma.userLeague.findUnique({
    where: { userId_leagueId: { userId, leagueId } },
  });
  if (!membership) throw new Error("Not a member of this league");

  return leagueId;
}

/**
 * If the user hasn't selected a league yet (no cookie), pick the first league
 * they belong to and return it. Returns null if they have no leagues.
 * Does NOT set the cookie — callers should set it in the response if needed.
 */
export async function resolveUserLeagueId(userId: string): Promise<string | null> {
  const existing = await getUserLeagueId();
  if (existing) {
    // Validate the cookie still points to a valid membership
    const ok = await prisma.userLeague.findUnique({
      where: { userId_leagueId: { userId, leagueId: existing } },
      select: { leagueId: true },
    });
    if (ok) return existing;
  }

  // Fall back to first league
  const first = await prisma.userLeague.findFirst({
    where: { userId },
    select: { leagueId: true },
    orderBy: { joinedAt: "asc" },
  });
  return first?.leagueId ?? null;
}

// ─── Admin-facing ────────────────────────────────────────────────────────────

/**
 * Resolve the league context for an admin request.
 * - DB admin: returns their AdminUser.leagueId (from the database)
 * - Superadmin: returns the value of the admin_league_context cookie, or null
 */
export async function getAdminLeagueId(
  adminSession: { role: "superadmin" } | { role: "admin"; adminId: string } | null
): Promise<string | null> {
  if (!adminSession) return null;

  if (adminSession.role === "admin") {
    const admin = await prisma.adminUser.findUnique({
      where: { id: adminSession.adminId },
      select: { leagueId: true },
    });
    return admin?.leagueId ?? null;
  }

  // Superadmin — read from cookie
  const cookieStore = await cookies();
  return cookieStore.get(ADMIN_LEAGUE_COOKIE)?.value ?? null;
}

// ─── Cookie helpers ──────────────────────────────────────────────────────────

const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";

export function setUserLeagueCookie(leagueId: string): string {
  return `${USER_LEAGUE_COOKIE}=${leagueId}; Path=/; SameSite=Lax; Max-Age=31536000${secure}`;
}

export function clearUserLeagueCookie(): string {
  return `${USER_LEAGUE_COOKIE}=; Path=/; SameSite=Lax; Max-Age=0${secure}`;
}

export function setAdminLeagueCookie(leagueId: string): string {
  return `${ADMIN_LEAGUE_COOKIE}=${leagueId}; Path=/; HttpOnly; SameSite=Lax; Max-Age=86400${secure}`;
}
