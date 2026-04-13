import { redirect } from "next/navigation";
import { verifyAdminSession } from "@/lib/admin-auth";
import { AdminHeader } from "@/components/admin-header";
import { LeaderboardTabs } from "@/app/leaderboard/leaderboard-tabs";

export default async function AdminLeaderboardPage() {
  if (!(await verifyAdminSession())) {
    redirect("/admindash/login");
  }

  return (
    <div className="min-h-screen bg-zinc-900">
      <AdminHeader active="leaderboard" />

      <main className="mx-auto max-w-6xl px-6 py-10">
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-zinc-50">Leaderboard</h2>
          <p className="mt-1 text-zinc-400">Season standings and weekly rankings</p>
        </div>

        <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-6">
          {/* userId="" means no user is highlighted as "you" */}
          <LeaderboardTabs userId="" />
        </div>
      </main>
    </div>
  );
}
