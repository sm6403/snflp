"use client";

export interface ExpandedStatsData {
  streak: number;
  bestWeekPct: number | null;
  bestWeekLabel: string;
  bestWeekCorrect: number;
  bestWeekGraded: number;
  worstWeekPct: number | null;
  worstWeekLabel: string;
  worstWeekCorrect: number;
  worstWeekGraded: number;
  perfectWeeks: number;
  homePickPct: number | null;
  homePickCount: number;
  awayPickCount: number;
  homeAccuracy: number | null;
  awayAccuracy: number | null;
  upsetAccuracy: number | null;
  upsetOpportunities: number;
  upsetCorrect: number;
  mostPickedTeams: { name: string; abbreviation: string; espnId: string }[];
  mostPickedCount: number;
  mySeasonRank: number | null;
  myWeeklyRank: number | null;
  totalPlayers: number;
  leagueAvgPct: number | null;
  vsLeagueDelta: number | null;
  rolling4Pct: number | null;
  rolling4Weeks: number;
  mostRecentWeekLabel: string;
}

// ─── Shared tile ─────────────────────────────────────────────────────────────

function Tile({
  label,
  children,
  sub,
  className = "",
}: {
  label: string;
  children: React.ReactNode;
  sub?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-lg border border-zinc-100 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900/60 ${className}`}
    >
      <p className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
        {label}
      </p>
      <div className="mt-1">{children}</div>
      {sub && <p className="mt-0.5 text-xs text-zinc-400">{sub}</p>}
    </div>
  );
}

// ─── Section divider ──────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="mt-6 mb-3 text-xs font-semibold uppercase tracking-widest text-zinc-400 dark:text-zinc-500">
      {children}
    </p>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function ExpandedStats({ data }: { data: ExpandedStatsData }) {
  const pctColor = (pct: number | null) => {
    if (pct === null) return "text-zinc-400";
    if (pct >= 70) return "text-green-500";
    if (pct >= 50) return "text-yellow-500";
    return "text-red-500";
  };

  const deltaColor = (delta: number | null) => {
    if (delta === null) return "text-zinc-400";
    if (delta > 0) return "text-green-500";
    if (delta < 0) return "text-red-500";
    return "text-zinc-400";
  };

  const rankSuffix = (n: number) => {
    if (n % 100 >= 11 && n % 100 <= 13) return "th";
    if (n % 10 === 1) return "st";
    if (n % 10 === 2) return "nd";
    if (n % 10 === 3) return "rd";
    return "th";
  };

  return (
    <div>
      {/* ── Form ── */}
      <SectionLabel>Form</SectionLabel>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <Tile
          label="Week streak"
          sub={data.streak > 0 ? "consecutive ≥50% weeks" : "no active streak"}
        >
          <p className={`text-3xl font-bold ${data.streak > 0 ? "text-amber-500" : "text-zinc-400"}`}>
            {data.streak > 0 ? `${data.streak} 🔥` : "—"}
          </p>
        </Tile>

        <Tile
          label={`Last ${data.rolling4Weeks} weeks`}
          sub={
            data.rolling4Pct !== null && data.rolling4Weeks > 0
              ? `rolling accuracy`
              : undefined
          }
        >
          {data.rolling4Pct !== null ? (
            <p className={`text-3xl font-bold ${pctColor(data.rolling4Pct)}`}>
              {data.rolling4Pct}%
            </p>
          ) : (
            <p className="text-sm text-zinc-400">—</p>
          )}
        </Tile>

        <Tile
          label="Perfect weeks"
          sub={data.perfectWeeks > 0 ? "100% correct" : "none yet"}
        >
          <p
            className={`text-3xl font-bold ${
              data.perfectWeeks > 0 ? "text-indigo-500" : "text-zinc-400"
            }`}
          >
            {data.perfectWeeks > 0 ? data.perfectWeeks : "—"}
          </p>
        </Tile>
      </div>

      {/* ── Peaks ── */}
      <SectionLabel>Peaks</SectionLabel>
      <div className="grid grid-cols-2 gap-4">
        <Tile
          label="Best week"
          sub={
            data.bestWeekPct !== null
              ? `${data.bestWeekLabel} · ${data.bestWeekCorrect}/${data.bestWeekGraded}`
              : undefined
          }
        >
          {data.bestWeekPct !== null ? (
            <p className="text-3xl font-bold text-green-500">{data.bestWeekPct}%</p>
          ) : (
            <p className="text-sm text-zinc-400">—</p>
          )}
        </Tile>

        <Tile
          label="Worst week"
          sub={
            data.worstWeekPct !== null
              ? `${data.worstWeekLabel} · ${data.worstWeekCorrect}/${data.worstWeekGraded}`
              : undefined
          }
        >
          {data.worstWeekPct !== null ? (
            <p className="text-3xl font-bold text-red-500">{data.worstWeekPct}%</p>
          ) : (
            <p className="text-sm text-zinc-400">—</p>
          )}
        </Tile>
      </div>

      {/* ── Tendencies ── */}
      <SectionLabel>Tendencies</SectionLabel>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <Tile
          label="Home team bias"
          sub={
            data.homePickPct !== null
              ? `${data.homePickCount} home · ${data.awayPickCount} away`
              : "not enough data"
          }
        >
          {data.homePickPct !== null ? (
            <div className="flex items-baseline gap-1.5">
              <p className="text-3xl font-bold text-zinc-200">{data.homePickPct}%</p>
              <p className="text-xs text-zinc-500">home picks</p>
            </div>
          ) : (
            <p className="text-sm text-zinc-400">—</p>
          )}
          {(data.homeAccuracy !== null || data.awayAccuracy !== null) && (
            <div className="mt-2 flex gap-3 text-xs">
              {data.homeAccuracy !== null && (
                <span className={pctColor(data.homeAccuracy)}>
                  Home {data.homeAccuracy}%
                </span>
              )}
              {data.awayAccuracy !== null && (
                <span className={pctColor(data.awayAccuracy)}>
                  Away {data.awayAccuracy}%
                </span>
              )}
            </div>
          )}
        </Tile>

        <Tile
          label="Upset accuracy"
          sub={
            data.upsetOpportunities > 0
              ? `${data.upsetCorrect}/${data.upsetOpportunities} upsets called`
              : "no away-team wins yet"
          }
        >
          {data.upsetAccuracy !== null ? (
            <p className={`text-3xl font-bold ${pctColor(data.upsetAccuracy)}`}>
              {data.upsetAccuracy}%
            </p>
          ) : (
            <p className="text-sm text-zinc-400">—</p>
          )}
        </Tile>

        <Tile
          label="Most picked team"
          sub={
            data.mostPickedTeams.length > 0
              ? `${data.mostPickedCount} pick${data.mostPickedCount !== 1 ? "s" : ""} this season${data.mostPickedTeams.length > 1 ? " (tied)" : ""}`
              : undefined
          }
        >
          {data.mostPickedTeams.length > 0 ? (
            <div className="flex flex-wrap items-center gap-2">
              {data.mostPickedTeams.map((team) => (
                <div key={team.espnId} className="flex items-center gap-1.5">
                  <img
                    src={`https://a.espncdn.com/i/teamlogos/nfl/500/${team.espnId}.png`}
                    alt={team.abbreviation}
                    className="h-8 w-8 object-contain"
                  />
                  <p className="text-xl font-bold text-zinc-100">{team.abbreviation}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-zinc-400">—</p>
          )}
        </Tile>
      </div>

      {/* ── vs League ── */}
      <SectionLabel>vs League</SectionLabel>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <Tile
          label={`This week rank`}
          sub={
            data.myWeeklyRank !== null
              ? `${data.mostRecentWeekLabel} · of ${data.totalPlayers}`
              : undefined
          }
        >
          {data.myWeeklyRank !== null ? (
            <div className="flex items-baseline gap-0.5">
              <p className="text-3xl font-bold text-zinc-100">{data.myWeeklyRank}</p>
              <p className="text-lg font-semibold text-zinc-400">
                {rankSuffix(data.myWeeklyRank)}
              </p>
            </div>
          ) : (
            <p className="text-sm text-zinc-400">—</p>
          )}
        </Tile>

        <Tile
          label="Season rank"
          sub={data.mySeasonRank !== null ? `of ${data.totalPlayers} players` : undefined}
        >
          {data.mySeasonRank !== null ? (
            <div className="flex items-baseline gap-0.5">
              <p className="text-3xl font-bold text-zinc-100">{data.mySeasonRank}</p>
              <p className="text-lg font-semibold text-zinc-400">
                {rankSuffix(data.mySeasonRank)}
              </p>
            </div>
          ) : (
            <p className="text-sm text-zinc-400">—</p>
          )}
        </Tile>

        <Tile
          label="vs League avg"
          sub={
            data.vsLeagueDelta !== null && data.leagueAvgPct !== null
              ? `League avg ${data.leagueAvgPct}%`
              : "not enough data"
          }
        >
          {data.vsLeagueDelta !== null ? (
            <p className={`text-3xl font-bold ${deltaColor(data.vsLeagueDelta)}`}>
              {data.vsLeagueDelta > 0 ? "+" : ""}
              {data.vsLeagueDelta}%
            </p>
          ) : (
            <p className="text-sm text-zinc-400">—</p>
          )}
        </Tile>
      </div>
    </div>
  );
}
