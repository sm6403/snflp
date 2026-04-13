/**
 * seed-2025-full.ts
 *
 * - Deletes the 2024 season (and any existing 2025 data) completely
 * - Creates the 2025 season (isCurrent: true) with all 18 weeks
 * - Each week gets 16 games covering all 32 teams
 * - Team records are computed per-week based on team performance tier
 * - Sets AppSettings test mode → 2025 Week 15
 */
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

// ---------------------------------------------------------------------------
// Team performance tiers → win rates for invented records
// ---------------------------------------------------------------------------
const TIERS: Record<string, "top" | "good" | "avg" | "med"> = {
  // Top (~13 W over 18 games)
  KC: "top", DET: "top", MIN: "top", PHI: "top", BUF: "top",
  // Good (~11 W)
  LAC: "good", BAL: "good", LAR: "good", HOU: "good",
  GB: "good", SEA: "good", WSH: "good",
  // Average (~9 W)
  SF: "avg", CIN: "avg", DEN: "avg", PIT: "avg",
  ATL: "avg", TB: "avg", IND: "avg", MIA: "avg", ARI: "avg", DAL: "avg",
  // Mediocre (~5 W)
  NE: "med", NYJ: "med", LV: "med", CLE: "med",
  JAX: "med", TEN: "med", NYG: "med", CHI: "med", NO: "med", CAR: "med",
};
const WIN_RATES = { top: 0.76, good: 0.65, avg: 0.50, med: 0.30 };

function recordForWeek(abbr: string, weekNum: number) {
  const tier = TIERS[abbr] ?? "avg";
  const gamesPlayed = weekNum - 1;
  const wins = Math.round(gamesPlayed * WIN_RATES[tier]);
  return { wins, losses: gamesPlayed - wins, ties: 0 };
}

// ---------------------------------------------------------------------------
// Full 18-week schedule — each week: [awayAbbr, homeAbbr][]
// Every team appears exactly once per week (16 games × 2 teams = 32 teams).
// ---------------------------------------------------------------------------
const SCHEDULE: [string, string][][] = [
  // Week 1 — Sep 7
  [["BUF","MIA"],["NE","NYJ"],["BAL","CIN"],["CLE","PIT"],["HOU","IND"],["JAX","TEN"],["DEN","KC"],["LV","LAC"],["DAL","NYG"],["PHI","WSH"],["CHI","DET"],["GB","MIN"],["ATL","CAR"],["NO","TB"],["ARI","LAR"],["SF","SEA"]],
  // Week 2 — Sep 14
  [["MIA","BUF"],["NYJ","NE"],["CIN","BAL"],["PIT","CLE"],["IND","HOU"],["TEN","JAX"],["KC","DEN"],["LAC","LV"],["NYG","DAL"],["WSH","PHI"],["DET","CHI"],["MIN","GB"],["CAR","ATL"],["TB","NO"],["LAR","ARI"],["SEA","SF"]],
  // Week 3 — Sep 21
  [["BUF","NYJ"],["MIA","NE"],["BAL","PIT"],["CIN","CLE"],["HOU","TEN"],["IND","JAX"],["DEN","LV"],["KC","LAC"],["DAL","WSH"],["PHI","NYG"],["CHI","GB"],["DET","MIN"],["ATL","TB"],["CAR","NO"],["ARI","SEA"],["LAR","SF"]],
  // Week 4 — Sep 28
  [["NYJ","BUF"],["NE","MIA"],["PIT","BAL"],["CLE","CIN"],["TEN","HOU"],["JAX","IND"],["LV","DEN"],["LAC","KC"],["WSH","DAL"],["NYG","PHI"],["GB","CHI"],["MIN","DET"],["TB","ATL"],["NO","CAR"],["SEA","ARI"],["SF","LAR"]],
  // Week 5 — Oct 5
  [["BUF","CIN"],["MIA","PIT"],["NE","CLE"],["NYJ","BAL"],["HOU","KC"],["IND","DEN"],["JAX","LV"],["TEN","LAC"],["DAL","CHI"],["NYG","DET"],["PHI","GB"],["WSH","MIN"],["ATL","ARI"],["CAR","SEA"],["NO","SF"],["TB","LAR"]],
  // Week 6 — Oct 12
  [["CIN","BUF"],["PIT","MIA"],["CLE","NE"],["BAL","NYJ"],["KC","HOU"],["DEN","IND"],["LV","JAX"],["LAC","TEN"],["CHI","DAL"],["DET","NYG"],["GB","PHI"],["MIN","WSH"],["ARI","ATL"],["SEA","CAR"],["SF","NO"],["LAR","TB"]],
  // Week 7 — Oct 19
  [["BUF","HOU"],["MIA","IND"],["NE","JAX"],["NYJ","TEN"],["BAL","DEN"],["CIN","KC"],["CLE","LV"],["PIT","LAC"],["DAL","ATL"],["NYG","CAR"],["PHI","NO"],["WSH","TB"],["CHI","ARI"],["DET","LAR"],["GB","SF"],["MIN","SEA"]],
  // Week 8 — Oct 26
  [["HOU","BUF"],["IND","MIA"],["JAX","NE"],["TEN","NYJ"],["DEN","BAL"],["KC","CIN"],["LV","CLE"],["LAC","PIT"],["ATL","DAL"],["CAR","NYG"],["NO","PHI"],["TB","WSH"],["ARI","CHI"],["LAR","DET"],["SF","GB"],["SEA","MIN"]],
  // Week 9 — Nov 2
  [["BUF","DAL"],["MIA","NYG"],["NE","PHI"],["NYJ","WSH"],["BAL","ATL"],["CIN","CAR"],["CLE","NO"],["PIT","TB"],["HOU","ARI"],["IND","LAR"],["JAX","SF"],["TEN","SEA"],["DEN","CHI"],["KC","DET"],["LV","GB"],["LAC","MIN"]],
  // Week 10 — Nov 9
  [["DAL","BUF"],["NYG","MIA"],["PHI","NE"],["WSH","NYJ"],["ATL","BAL"],["CAR","CIN"],["NO","CLE"],["TB","PIT"],["ARI","HOU"],["LAR","IND"],["SF","JAX"],["SEA","TEN"],["CHI","DEN"],["DET","KC"],["GB","LV"],["MIN","LAC"]],
  // Week 11 — Nov 16
  [["BUF","LAC"],["MIA","LV"],["NE","DEN"],["NYJ","KC"],["BAL","SEA"],["CIN","SF"],["CLE","LAR"],["PIT","ARI"],["HOU","MIN"],["IND","GB"],["JAX","DET"],["TEN","CHI"],["DAL","NO"],["NYG","TB"],["PHI","CAR"],["WSH","ATL"]],
  // Week 12 — Nov 23 (Thanksgiving)
  [["LAC","BUF"],["LV","MIA"],["DEN","NE"],["KC","NYJ"],["SEA","BAL"],["SF","CIN"],["LAR","CLE"],["ARI","PIT"],["MIN","HOU"],["GB","IND"],["DET","JAX"],["CHI","TEN"],["NO","DAL"],["TB","NYG"],["CAR","PHI"],["ATL","WSH"]],
  // Week 13 — Nov 30
  [["BUF","PIT"],["MIA","CLE"],["NE","BAL"],["NYJ","CIN"],["HOU","LAC"],["IND","LV"],["JAX","DEN"],["TEN","KC"],["DAL","MIN"],["NYG","GB"],["PHI","DET"],["WSH","CHI"],["ATL","SF"],["CAR","SEA"],["NO","LAR"],["TB","ARI"]],
  // Week 14 — Dec 7
  [["PIT","BUF"],["CLE","MIA"],["BAL","NE"],["CIN","NYJ"],["LAC","HOU"],["LV","IND"],["DEN","JAX"],["KC","TEN"],["MIN","DAL"],["GB","NYG"],["DET","PHI"],["CHI","WSH"],["SF","ATL"],["SEA","CAR"],["LAR","NO"],["ARI","TB"]],
  // Week 15 — Dec 14 (isCurrent)
  [["ATL","TB"],["CLE","CHI"],["BAL","CIN"],["LAC","KC"],["BUF","NE"],["WSH","NYG"],["LV","PHI"],["NYJ","JAX"],["ARI","HOU"],["GB","DEN"],["DET","LAR"],["CAR","NO"],["TEN","SF"],["IND","SEA"],["MIN","DAL"],["MIA","PIT"]],
  // Week 16 — Dec 21
  [["LAR","SEA"],["PHI","WSH"],["GB","CHI"],["BUF","CLE"],["LAC","DAL"],["KC","TEN"],["CIN","MIA"],["NYJ","NO"],["MIN","NYG"],["TB","CAR"],["JAX","DEN"],["ATL","ARI"],["PIT","DET"],["LV","HOU"],["NE","BAL"],["SF","IND"]],
  // Week 17 — Dec 28
  [["BUF","KC"],["MIA","BAL"],["NE","PIT"],["NYJ","CLE"],["HOU","JAX"],["TEN","IND"],["DEN","LAC"],["LV","SF"],["DAL","PHI"],["NYG","WSH"],["CHI","MIN"],["DET","GB"],["ATL","SEA"],["CAR","LAR"],["NO","ARI"],["TB","CIN"]],
  // Week 18 — Jan 4, 2026
  [["PHI","DAL"],["WSH","NYG"],["MIN","CHI"],["GB","DET"],["SEA","ATL"],["LAR","NO"],["ARI","CAR"],["CIN","TB"],["BAL","BUF"],["PIT","MIA"],["CLE","NE"],["NYJ","HOU"],["TEN","IND"],["DEN","LV"],["LAC","KC"],["JAX","SF"]],
];

// Base Sunday 1pm ET (18:00 UTC) date per week
const WEEK_BASE_DATES = [
  "2025-09-07", "2025-09-14", "2025-09-21", "2025-09-28",
  "2025-10-05", "2025-10-12", "2025-10-19", "2025-10-26",
  "2025-11-02", "2025-11-09", "2025-11-16", "2025-11-23",
  "2025-11-30", "2025-12-07", "2025-12-14", "2025-12-21",
  "2025-12-28", "2026-01-04",
];

// ---------------------------------------------------------------------------
// Helper: delete all data for a season year
// ---------------------------------------------------------------------------
async function deleteSeasonByYear(year: number) {
  const season = await prisma.season.findUnique({ where: { year_type: { year, type: "regular" } } });
  if (!season) {
    console.log(`  Season ${year} not found — nothing to delete.`);
    return;
  }
  const weeks = await prisma.week.findMany({ where: { seasonId: season.id }, select: { id: true } });
  const weekIds = weeks.map((w) => w.id);

  if (weekIds.length > 0) {
    const pickSets = await prisma.pickSet.findMany({ where: { weekId: { in: weekIds } }, select: { id: true } });
    const pickSetIds = pickSets.map((ps) => ps.id);
    if (pickSetIds.length > 0) {
      await prisma.pick.deleteMany({ where: { pickSetId: { in: pickSetIds } } });
      await prisma.pickSet.deleteMany({ where: { id: { in: pickSetIds } } });
    }
    await prisma.teamRecord.deleteMany({ where: { weekId: { in: weekIds } } });
    await prisma.game.deleteMany({ where: { weekId: { in: weekIds } } });
    await prisma.week.deleteMany({ where: { id: { in: weekIds } } });
  }
  await prisma.season.delete({ where: { id: season.id } });
  console.log(`  Deleted ${year} season (${weeks.length} weeks removed).`);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  const allTeams = await prisma.team.findMany();
  if (allTeams.length === 0) {
    console.error("No teams found — run `npx prisma db seed` first.");
    process.exit(1);
  }
  const teamByAbbr = Object.fromEntries(allTeams.map((t) => [t.abbreviation, t]));

  // Verify all abbreviations resolve before touching the DB
  const allAbbrs = new Set(SCHEDULE.flat().flat());
  const missing = [...allAbbrs].filter((a) => !teamByAbbr[a]);
  if (missing.length > 0) {
    console.error("Unknown team abbreviations:", missing.join(", "));
    process.exit(1);
  }

  // 1. Delete old seasons
  console.log("Deleting 2024 season...");
  await deleteSeasonByYear(2024);

  console.log("Deleting existing 2025 season...");
  await deleteSeasonByYear(2025);

  // 2. Create 2025 season as current
  console.log("\nCreating 2025 season (isCurrent: true)...");
  const season = await prisma.season.create({
    data: { year: 2025, type: "regular", mode: "live", isCurrent: true },
  });

  // 3. Seed all 18 weeks
  let week15Id: string | null = null;

  for (let i = 0; i < 18; i++) {
    const weekNum = i + 1;
    const isCurrentWeek = weekNum === 15;
    const baseDate = WEEK_BASE_DATES[i];

    process.stdout.write(`  Seeding Week ${weekNum}...`);

    const week = await prisma.week.create({
      data: {
        seasonId: season.id,
        number: weekNum,
        label: `Week ${weekNum}`,
        isCurrent: isCurrentWeek,
        lockedForSubmission: false,
      },
    });

    if (isCurrentWeek) week15Id = week.id;

    // Games — first 12 kick off at 1pm ET (18:00 UTC), next 3 at 4:25pm (21:25 UTC),
    // last 1 at 8:20pm ET (00:20 UTC next day, so +26h20m from base date 18:00 UTC)
    const GAME_OFFSETS_MS = [
      ...Array(12).fill(0),
      ...Array(3).fill(Math.round(3.4167 * 3600000)),
      Math.round(6.333 * 3600000), // 8:20pm = 18:00 + 6h20m
    ];

    const matchups = SCHEDULE[i];
    for (let g = 0; g < matchups.length; g++) {
      const [awayAbbr, homeAbbr] = matchups[g];
      const gameTime = new Date(new Date(`${baseDate}T18:00:00Z`).getTime() + GAME_OFFSETS_MS[g]);
      await prisma.game.create({
        data: {
          weekId: week.id,
          homeTeamId: teamByAbbr[homeAbbr].id,
          awayTeamId: teamByAbbr[awayAbbr].id,
          gameTime,
        },
      });
    }

    // Team records — all 32 teams play every week
    const weekTeams = new Set(matchups.flatMap(([a, h]) => [a, h]));
    for (const abbr of weekTeams) {
      const team = teamByAbbr[abbr];
      await prisma.teamRecord.create({
        data: { teamId: team.id, weekId: week.id, ...recordForWeek(abbr, weekNum) },
      });
    }

    console.log(` done (id: ${week.id}${isCurrentWeek ? " ← current" : ""})`);
  }

  // 4. Point AppSettings test mode at Week 15
  await prisma.appSettings.upsert({
    where: { id: "singleton" },
    update: { mode: "test", testSeasonId: season.id, testWeekId: week15Id! },
    create: { id: "singleton", mode: "test", testSeasonId: season.id, testWeekId: week15Id! },
  });

  console.log(`\n✓ 2025 season seeded with 18 weeks.`);
  console.log(`✓ Test mode → Week 15 (id: ${week15Id})`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
