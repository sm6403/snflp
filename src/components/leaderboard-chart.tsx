"use client";

// Distinct colours that read well on both light and dark backgrounds
const PALETTE = [
  "#6366f1", // indigo
  "#22c55e", // green
  "#f59e0b", // amber
  "#ef4444", // red
  "#06b6d4", // cyan
  "#a855f7", // purple
  "#f97316", // orange
  "#14b8a6", // teal
  "#ec4899", // pink
  "#84cc16", // lime
  "#f43f5e", // rose
  "#0ea5e9", // sky
];

export interface ChartSeries {
  userId: string;
  displayName: string;
  ranks: (number | null)[];
}

interface Props {
  weeks: Array<{ weekNumber: number; weekLabel: string }>;
  series: ChartSeries[];
  /** Empty string = no user to highlight (admin view) */
  currentUserId: string;
  maxY: number;
}

export function LeaderboardMultiChart({ weeks, series, currentUserId, maxY }: Props) {
  if (weeks.length === 0 || series.length === 0) return null;

  // Assign stable colours by sorting users by their userId (deterministic)
  const sortedForColor = [...series].sort((a, b) => a.userId.localeCompare(b.userId));
  const colorMap = new Map(
    sortedForColor.map((s, i) => [s.userId, PALETTE[i % PALETTE.length]])
  );

  // SVG geometry
  const W = 600;
  const H = 190;
  const pad = { top: 18, right: 18, bottom: 30, left: 30 };
  const pw = W - pad.left - pad.right;
  const ph = H - pad.top - pad.bottom;

  const xMin = weeks[0].weekNumber;
  const xMax = weeks[weeks.length - 1].weekNumber;
  const xRange = Math.max(xMax - xMin, 1);
  const yRange = Math.max(maxY - 1, 1);

  const toX = (weekNum: number) =>
    weeks.length === 1
      ? pad.left + pw / 2
      : pad.left + ((weekNum - xMin) / xRange) * pw;

  const toY = (rank: number) => pad.top + ((rank - 1) / yRange) * ph;

  // Y-axis tick marks
  const yTicks: number[] =
    maxY <= 6
      ? Array.from({ length: maxY }, (_, i) => i + 1)
      : [1, Math.round(maxY / 2), maxY];

  // Build polyline segments (break on nulls)
  function segments(s: ChartSeries): string[][] {
    const result: string[][] = [];
    let seg: string[] = [];
    for (let i = 0; i < weeks.length; i++) {
      const r = s.ranks[i];
      if (r !== null) {
        seg.push(`${toX(weeks[i].weekNumber).toFixed(1)},${toY(r).toFixed(1)}`);
      } else if (seg.length > 0) {
        result.push(seg);
        seg = [];
      }
    }
    if (seg.length > 0) result.push(seg);
    return result;
  }

  // Render order: others first, current user on top
  const others = series.filter((s) => s.userId !== currentUserId || currentUserId === "");
  const meArr = series.filter((s) => s.userId === currentUserId && currentUserId !== "");
  const ordered = currentUserId ? [...others, ...meArr] : series;

  return (
    <div className="mt-5">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        style={{ display: "block", overflow: "visible" }}
        aria-hidden="true"
      >
        {/* Plot area */}
        <rect
          x={pad.left}
          y={pad.top}
          width={pw}
          height={ph}
          fill="rgba(0,0,0,0.12)"
          rx="3"
        />

        {/* Horizontal grid lines + Y labels */}
        {yTicks.map((rank) => {
          const y = toY(rank);
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
                fill="rgba(255,255,255,0.3)"
              >
                {rank}
              </text>
            </g>
          );
        })}

        {/* Baseline */}
        <line
          x1={pad.left}
          y1={pad.top + ph}
          x2={pad.left + pw}
          y2={pad.top + ph}
          stroke="rgba(255,255,255,0.12)"
          strokeWidth="1"
        />

        {/* X-axis week labels */}
        {weeks.map((w) => (
          <text
            key={w.weekNumber}
            x={toX(w.weekNumber)}
            y={H - pad.bottom + 14}
            textAnchor="middle"
            fontSize="9"
            fill="rgba(255,255,255,0.3)"
          >
            W{w.weekNumber}
          </text>
        ))}

        {/* Series lines + dots */}
        {ordered.map((s) => {
          const isMe = s.userId === currentUserId && currentUserId !== "";
          const color = colorMap.get(s.userId)!;
          const sw = isMe ? 3 : 1.5;
          const opacity = isMe ? 1 : 0.65;
          const dotR = isMe ? 4.5 : 3;

          return (
            <g key={s.userId} opacity={opacity}>
              {segments(s).map((pts, i) => (
                <polyline
                  key={i}
                  points={pts.join(" ")}
                  fill="none"
                  stroke={color}
                  strokeWidth={sw}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              ))}
              {weeks.map((w, wi) => {
                const rank = s.ranks[wi];
                if (rank === null) return null;
                return (
                  <circle
                    key={w.weekNumber}
                    cx={toX(w.weekNumber)}
                    cy={toY(rank)}
                    r={dotR}
                    fill={color}
                    stroke="rgba(0,0,0,0.45)"
                    strokeWidth="1.5"
                  >
                    <title>
                      {s.displayName} — {w.weekLabel}: #{rank}
                    </title>
                  </circle>
                );
              })}
            </g>
          );
        })}
      </svg>

      {/* Legend */}
      <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5 px-1">
        {series.map((s) => {
          const isMe = s.userId === currentUserId && currentUserId !== "";
          const color = colorMap.get(s.userId)!;
          return (
            <div key={s.userId} className="flex items-center gap-1.5">
              <span
                className="h-2.5 w-2.5 flex-shrink-0 rounded-full"
                style={{ backgroundColor: color }}
              />
              <span
                className={`text-xs ${
                  isMe
                    ? "font-bold text-zinc-100"
                    : "font-normal text-zinc-500 dark:text-zinc-400"
                }`}
              >
                {s.displayName}
                {isMe && (
                  <span className="ml-1 text-indigo-400 dark:text-indigo-400">
                    (you)
                  </span>
                )}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
