import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { NFL_TEAM_COLORS } from "@/lib/nfl-team-colors";

// All valid ESPN IDs derived from the colour map
const VALID_ESPN_IDS = new Set(Object.values(NFL_TEAM_COLORS).map((c) => c.espnId));

export async function PATCH(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json() as { teamTheme?: string | null };
  const { teamTheme } = body;

  // null/undefined = clear theme; string = must be a valid ESPN ID
  if (teamTheme !== null && teamTheme !== undefined && !VALID_ESPN_IDS.has(teamTheme)) {
    return NextResponse.json({ error: "Invalid team theme" }, { status: 400 });
  }

  await prisma.user.update({
    where: { id: session.user.id },
    data: { teamTheme: teamTheme ?? null },
  });

  const response = NextResponse.json({ teamTheme: teamTheme ?? null });

  // Set or clear the team_theme cookie — the layout reads this server-side
  // to apply data-team-theme on <html> with zero client-side flash.
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  if (teamTheme) {
    response.headers.set(
      "Set-Cookie",
      `team_theme=${teamTheme}; Path=/; SameSite=Lax; Max-Age=${60 * 60 * 24 * 365}${secure}`
    );
  } else {
    response.headers.set(
      "Set-Cookie",
      `team_theme=; Path=/; SameSite=Lax; Max-Age=0${secure}`
    );
  }

  return response;
}
