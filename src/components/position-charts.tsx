"use client";

import { useEffect, useState } from "react";

interface WeekPoint {
  weekNumber: number;
  weekLabel: string;
  weeklyRank: number | null;
  seasonRank: number | null;
  totalPlayers: number;
  weeklyDivisionRank: number | null;
  seasonDivisionRank: number | null;
  divisionPlayerCount: number | null;
}

interface ChartDataPoint {
  x: number;        // week number
  y: number | null; // rank (null = not entered / not eligible)
  label: string;    // "Week N" for tooltip
}

// ── SVG line chart ────────────────────────────────────────────────────────────

function LineChart({
  title,
  color,
  data,
  maxY,
}: {
  title: string;
  color: string;
  data: ChartDataPoint[];
  maxY: number;
}) {
  const W = 240;
  const H = 240;
  const pad = { top: 18, right: 18, bottom: 30, left: 30 };
  const pw = W - pad.left - pad.right;
  const ph = H - pad.top - pad.bottom;

  const pointsWithData = data.filter((d) => d.y !== null);
  if (pointsWithData.length === 0) return null;

  const isSinglePoint = data.length === 1;
  const xMin = data[0].x;
  const xMax = data[data.length - 1].x;
  const xRange = Math.max(xMax - xMin, 1);
  const yRange = Math.max(maxY - 1, 1);

  const toSvgX = (x: number) =>
    isSinglePoint
      ? pad.left + pw / 2
      : pad.left + ((x - xMin) / xRange) * pw;

  // rank 1 → top (pad.top), rank maxY → bottom (pad.top + ph)
  const toSvgY = (y: number) => pad.top + ((y - 1) / yRange) * ph;

  // Build polyline segments, breaking on nulls
  const segments: string[][] = [];
  let seg: string[] = [];
  for (const d of data) {
    if (d.y !== null) {
      seg.push(`${toSvgX(d.x).toFixed(1)},${toSvgY(d.y).toFixed(1)}`);
    } else {
      if (seg.length > 0) {
        segments.push(seg);
        seg = [];
      }
    }
  }
  if (seg.length > 0) segments.push(seg);

  // Y-axis grid ticks
  const yTicks: number[] =
    maxY <= 6
      ? Array.from({ length: maxY }, (_, i) => i + 1)
      : [1, Math.round(maxY / 2), maxY];

  // Last non-null point (for the "#N" label)
  const lastPoint = [...data].reverse().find((d) => d.y !== null)!;
  const lastSvgX = toSvgX(lastPoint.x);
  const labelAnchor = lastSvgX > pad.left + pw - 32 ? "end" : "start";
  const labelOffsetX = labelAnchor === "end" ? -7 : 7;

  return (
    <div className="flex flex-col items-stretch">
      <p className="mb-2 text-center text-[11px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
        {title}
      </p>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full aspect-square"
        role="img"
        aria-label={title}
      >
        {/* Plot area background */}
        <rect
          x={pad.left}
          y={pad.top}
          width={pw}
          height={ph}
          fill="rgba(0,0,0,0.15)"
          rx="3"
        />

        {/* Y-axis grid lines + labels */}
        {yTicks.map((rank) => {
          const y = toSvgY(rank);
          return (
            <g key={rank}>
              <line
                x1={pad.left}
                y1={y}
                x2={pad.left + pw}
                y2={y}
                stroke="rgba(255,255,255,0.07)"
                strokeWidth="1"
              />
              <text
                x={pad.left - 5}
                y={y + 3.5}
                textAnchor="end"
                fontSize="9"
                fill="rgba(255,255,255,0.28)"
              >
                {rank}
              </text>
            </g>
          );
        })}

        {/* Bottom baseline */}
        <line
          x1={pad.left}
          y1={pad.top + ph}
          x2={pad.left + pw}
          y2={pad.top + ph}
          stroke="rgba(255,255,255,0.12)"
          strokeWidth="1"
        />

        {/* X-axis week labels */}
        {data.map((d) => (
          <text
            key={d.x}
            x={toSvgX(d.x)}
            y={H - pad.bottom + 14}
            textAnchor="middle"
            fontSize="9"
            fill="rgba(255,255,255,0.28)"
          >
            W{d.x}
          </text>
        ))}

        {/* Line segments */}
        {segments.map((pts, i) => (
          <polyline
            key={i}
            points={pts.join(" ")}
            fill="none"
            stroke={color}
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity="0.9"
          />
        ))}

        {/* Dots */}
        {pointsWithData.map((d) => (
          <circle
            key={d.x}
            cx={toSvgX(d.x)}
            cy={toSvgY(d.y!)}
            r="4"
            fill={color}
            stroke="rgba(0,0,0,0.5)"
            strokeWidth="1.5"
          >
            <title>
              {d.label}: #{d.y}
            </title>
          </circle>
        ))}

        {/* Current rank label near the last point */}
        <text
          x={lastSvgX + labelOffsetX}
          y={toSvgY(lastPoint.y!) - 7}
          textAnchor={labelAnchor}
          fontSize="12"
          fontWeight="bold"
          fill={color}
        >
          #{lastPoint.y}
        </text>
      </svg>
    </div>
  );
}

// ── Main export ───────────────────────────────────────────────────────────────

export function PositionCharts() {
  const [weeks, setWeeks] = useState<WeekPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [usesDivisions, setUsesDivisions] = useState(false);
  const [divisionName, setDivisionName] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"overall" | "division">("overall");

  useEffect(() => {
    fetch("/api/leaderboard/history")
      .then((r) => r.json())
      .then((d) => {
        setWeeks(d.weeks ?? []);
        setUsesDivisions(d.usesDivisions ?? false);
        setDivisionName(d.divisionName ?? null);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="mt-6 grid grid-cols-2 gap-4">
        <div className="aspect-square w-full animate-pulse rounded-lg bg-zinc-200 dark:bg-zinc-800/60" />
        <div className="aspect-square w-full animate-pulse rounded-lg bg-zinc-200 dark:bg-zinc-800/60" />
      </div>
    );
  }

  if (weeks.length === 0) return null;

  const isDivision = usesDivisions && viewMode === "division";
  const totalPlayers = weeks[0].totalPlayers;
  const divisionPlayerCount = weeks[0].divisionPlayerCount ?? totalPlayers;
  const maxY = isDivision ? divisionPlayerCount : totalPlayers;

  const weeklyData: ChartDataPoint[] = weeks.map((w) => ({
    x: w.weekNumber,
    y: isDivision ? w.weeklyDivisionRank : w.weeklyRank,
    label: w.weekLabel,
  }));

  const seasonData: ChartDataPoint[] = weeks.map((w) => ({
    x: w.weekNumber,
    y: isDivision ? w.seasonDivisionRank : w.seasonRank,
    label: w.weekLabel,
  }));

  // Don't render if both charts have no data points at all
  const hasWeekly = weeklyData.some((d) => d.y !== null);
  const hasSeason = seasonData.some((d) => d.y !== null);
  if (!hasWeekly && !hasSeason) return null;

  return (
    <div className="mt-6">
      {/* Overall / My Division toggle */}
      {usesDivisions && (
        <div className="mb-4 flex items-center justify-between gap-3">
          <div className="flex gap-1 rounded-lg border border-zinc-200 bg-zinc-100 p-1 dark:border-zinc-700 dark:bg-zinc-800/50">
            <button
              onClick={() => setViewMode("overall")}
              className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                viewMode === "overall"
                  ? "bg-white shadow-sm text-zinc-900 dark:bg-zinc-700 dark:text-zinc-50"
                  : "text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
              }`}
            >
              Overall
            </button>
            <button
              onClick={() => setViewMode("division")}
              className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                viewMode === "division"
                  ? "bg-white shadow-sm text-zinc-900 dark:bg-zinc-700 dark:text-zinc-50"
                  : "text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
              }`}
            >
              My Division
            </button>
          </div>
          {isDivision && divisionName && (
            <span className="inline-flex rounded-full border border-blue-500/30 bg-blue-500/10 px-2.5 py-0.5 text-xs text-blue-400">
              {divisionName} · {divisionPlayerCount} players
            </span>
          )}
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-lg border border-zinc-100 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900/60">
          <LineChart
            title="Weekly Position"
            color="#6366f1"
            data={weeklyData}
            maxY={maxY}
          />
        </div>
        <div className="rounded-lg border border-zinc-100 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900/60">
          <LineChart
            title="Season Position"
            color="#22c55e"
            data={seasonData}
            maxY={maxY}
          />
        </div>
      </div>
    </div>
  );
}
