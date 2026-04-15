import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { WeeklyPicks } from "@/components/weekly-picks";
import { resolveUserLeagueId } from "@/lib/league-context";

export default async function PicksPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/signin");
  }

  const leagueId = await resolveUserLeagueId(session.user.id);

  if (!leagueId) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-zinc-950">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">No League Found</h2>
          <p className="mt-2 text-zinc-600 dark:text-zinc-400">
            You are not a member of any league yet. Please contact your league administrator.
          </p>
        </div>
      </div>
    );
  }

  return <WeeklyPicks />;
}
