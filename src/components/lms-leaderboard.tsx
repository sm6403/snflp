"use client";

import { useEffect, useState } from "react";

interface LmsPickEntry {
  weekId: string;
  weekNumber: number;
  weekLabel: string;
  team: { id: string; name: string; abbreviation: string; espnId: string };
  result: "win" | "loss" | "pending";
  isEliminatedPick: boolean;
}

interface LmsPlayer {
  userId: string;
  displayName: string;
  showOnLeaderboard: boolean;
  status: "active" | "eliminated";
  eliminatedWeekNumber: number | null;
  picks: LmsPickEntry[];
}

interface LmsData {
  season: { id: string; year: number } | null;
  ruleLMS: boolean;
  players: LmsPlayer[];
}

function PickLogo({ pick }: { pick: LmsPickEntry }) {
  const logoUrl = `https://a.espncdn.com/i/teamlogos/nfl/500/${pick.team.espnId}.png`;

  let ring = "";
  let tint = "";
  let badge: React.ReactNode = null;

  if (pick.result === "win") {
    ring = "ring-1 ring-green-500/40";
  } else if (pick.result === "pending") {
    ring = "ring-1 ring-amber-500/60";
  } else {
    // loss / eliminated
    ring = "ring-1 ring-red-500/60";
    tint = "opacity-60";
    badge = (
      <span className="absolute -bottom-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-600 text-[9px] text-white">
        ✗
      </span>
    );
  }

  if (pick.result === "win") {
    badge = (
      <span className="absolute -bottom-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-green-600 text-[9px] text-white">
        ✓
      </span>
    );
  }

  return (
    <div className="relative flex flex-col items-center gap-0.5" title={`Wk ${pick.weekNumber}: ${pick.team.name}`}>
      <div className={`relative rounded-md p-0.5 ${ring}`}>
        <img
          src={logoUrl}
          alt={pick.team.abbreviation}
          className={`h-8 w-8 object-contain ${tint}`}
        />
        {badge}
      </div>
      <span className="text-[9px] text-zinc-600">{pick.team.abbreviation}</span>
    </div>
  );
}

function PlayerRow({
  player,
  currentUserId,
}: {
  player: LmsPlayer;
  currentUserId: string;
}) {
  const isMe = player.userId === currentUserId;
  const isActive = player.status === "active";

  return (
    <div
      className={`flex items-center gap-4 rounded-lg border px-4 py-3 ${
        isMe
          ? "border-indigo-700/40 bg-indigo-900/10"
          : "border-zinc-800 bg-zinc-900/30"
      }`}
    >
      {/* Name + status */}
      <div className="w-36 shrink-0">
        <p className={`text-sm font-medium ${isMe ? "text-indigo-300" : "text-zinc-100"}`}>
          {player.displayName}
          {isMe && <span className="ml-1 text-xs text-indigo-500">(you)</span>}
        </p>
        {isActive ? (
          <span className="mt-0.5 inline-flex items-center gap-1 rounded-full bg-green-600/20 px-2 py-0.5 text-[10px] font-semibold text-green-400">
            <span className="h-1.5 w-1.5 rounded-full bg-green-400" />
            ACTIVE
          </span>
        ) : (
          <span className="mt-0.5 inline-flex rounded-full bg-red-600/20 px-2 py-0.5 text-[10px] font-semibold text-red-400">
            OUT — Wk {player.eliminatedWeekNumber}
          </span>
        )}
      </div>

      {/* Pick history */}
      <div className="flex flex-wrap gap-2">
        {player.picks.length === 0 ? (
          <span className="text-xs text-zinc-600">No picks yet</span>
        ) : (
          player.picks.map((pick) => <PickLogo key={pick.weekId} pick={pick} />)
        )}
      </div>
    </div>
  );
}

export function LmsLeaderboard({ currentUserId }: { currentUserId: string }) {
  const [data, setData] = useState<LmsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/leaderboard/lms")
      .then((r) => r.json())
      .then((d) => {
        setData(d);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <p className="text-zinc-500">Loading...</p>
      </div>
    );
  }

  if (!data?.ruleLMS) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <p className="text-4xl mb-3">⚔️</p>
        <p className="text-zinc-400 font-medium">Last Man Standing is not enabled for this season.</p>
        <p className="mt-1 text-sm text-zinc-600">An admin can enable it in Season → Custom Rules.</p>
      </div>
    );
  }

  const activePlayers = data.players.filter((p) => p.status === "active");
  const eliminatedPlayers = data.players.filter((p) => p.status === "eliminated");

  if (data.players.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <p className="text-4xl mb-3">⚔️</p>
        <p className="text-zinc-400 font-medium">No Last Man Standing picks yet.</p>
        <p className="mt-1 text-sm text-zinc-600">Players can submit their LMS pick alongside their weekly picks.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Still Standing */}
      {activePlayers.length > 0 && (
        <div>
          <div className="mb-3 flex items-center gap-2 border-b border-green-700/30 pb-2">
            <span className="text-green-400">⚔️</span>
            <h2 className="text-sm font-semibold text-green-400">
              Still Standing
              <span className="ml-2 rounded-full bg-green-600/20 px-2 py-0.5 text-xs font-medium text-green-400">
                {activePlayers.length}
              </span>
            </h2>
          </div>
          <div className="space-y-2">
            {activePlayers.map((player) => (
              <PlayerRow key={player.userId} player={player} currentUserId={currentUserId} />
            ))}
          </div>
        </div>
      )}

      {/* Eliminated */}
      {eliminatedPlayers.length > 0 && (
        <div>
          <div className="mb-3 flex items-center gap-2 border-b border-red-700/30 pb-2">
            <span className="text-red-400">💀</span>
            <h2 className="text-sm font-semibold text-red-400">
              Eliminated
              <span className="ml-2 rounded-full bg-red-600/20 px-2 py-0.5 text-xs font-medium text-red-400">
                {eliminatedPlayers.length}
              </span>
            </h2>
          </div>
          <div className="space-y-2">
            {eliminatedPlayers.map((player) => (
              <PlayerRow key={player.userId} player={player} currentUserId={currentUserId} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
