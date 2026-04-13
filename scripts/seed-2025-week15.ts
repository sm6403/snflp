import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

// Week 15 games: [awayAbbr, homeAbbr, gameTimeUTC]
const WEEK15_GAMES: [string, string, string][] = [
  ["ATL", "TB",  "2025-12-12T18:15:00Z"], // Fri Dec 12 1:15pm ET
  ["CLE", "CHI", "2025-12-14T18:00:00Z"], // Sun Dec 14 1:00pm ET
  ["BAL", "CIN", "2025-12-14T18:00:00Z"],
  ["LAC", "KC",  "2025-12-14T18:00:00Z"],
  ["BUF", "NE",  "2025-12-14T18:00:00Z"],
  ["WSH", "NYG", "2025-12-14T18:00:00Z"],
  ["LV",  "PHI", "2025-12-14T18:00:00Z"],
  ["NYJ", "JAX", "2025-12-14T18:00:00Z"],
  ["ARI", "HOU", "2025-12-14T18:00:00Z"],
  ["GB",  "DEN", "2025-12-14T18:00:00Z"],
  ["DET", "LAR", "2025-12-14T21:05:00Z"], // Sun Dec 14 4:05pm ET
  ["CAR", "NO",  "2025-12-14T21:05:00Z"],
  ["TEN", "SF",  "2025-12-14T21:25:00Z"],
  ["IND", "SEA", "2025-12-14T21:25:00Z"],
  ["MIN", "DAL", "2025-12-15T01:20:00Z"], // Sun Dec 14 8:20pm ET
  ["MIA", "PIT", "2025-12-16T00:15:00Z"], // Tue Dec 16 (MNF)
];

// Invented Week 15 standings (heading into the game)
const RECORDS: Record<string, { wins: number; losses: number; ties: number }> = {
  ATL: { wins: 6,  losses: 7,  ties: 0 },
  TB:  { wins: 8,  losses: 5,  ties: 0 },
  CLE: { wins: 3,  losses: 10, ties: 0 },
  CHI: { wins: 4,  losses: 9,  ties: 0 },
  BAL: { wins: 9,  losses: 4,  ties: 0 },
  CIN: { wins: 6,  losses: 7,  ties: 0 },
  LAC: { wins: 8,  losses: 5,  ties: 0 },
  KC:  { wins: 12, losses: 1,  ties: 0 },
  BUF: { wins: 10, losses: 3,  ties: 0 },
  NE:  { wins: 4,  losses: 9,  ties: 0 },
  WSH: { wins: 9,  losses: 4,  ties: 0 },
  NYG: { wins: 3,  losses: 10, ties: 0 },
  LV:  { wins: 3,  losses: 10, ties: 0 },
  PHI: { wins: 11, losses: 2,  ties: 0 },
  NYJ: { wins: 4,  losses: 9,  ties: 0 },
  JAX: { wins: 4,  losses: 9,  ties: 0 },
  ARI: { wins: 7,  losses: 6,  ties: 0 },
  HOU: { wins: 8,  losses: 5,  ties: 0 },
  GB:  { wins: 9,  losses: 4,  ties: 0 },
  DEN: { wins: 8,  losses: 5,  ties: 0 },
  DET: { wins: 12, losses: 1,  ties: 0 },
  LAR: { wins: 9,  losses: 4,  ties: 0 },
  CAR: { wins: 3,  losses: 10, ties: 0 },
  NO:  { wins: 5,  losses: 8,  ties: 0 },
  TEN: { wins: 3,  losses: 10, ties: 0 },
  SF:  { wins: 7,  losses: 6,  ties: 0 },
  IND: { wins: 7,  losses: 6,  ties: 0 },
  SEA: { wins: 9,  losses: 4,  ties: 0 },
  MIN: { wins: 12, losses: 1,  ties: 0 },
  DAL: { wins: 7,  losses: 6,  ties: 0 },
  MIA: { wins: 6,  losses: 7,  ties: 0 },
  PIT: { wins: 9,  losses: 4,  ties: 0 },
};

async function main() {
  const allTeams = await prisma.team.findMany();
  if (allTeams.length === 0) {
    console.error("No teams found — run npx prisma db seed first.");
    process.exit(1);
  }
  const teamByAbbr = Object.fromEntries(allTeams.map((t) => [t.abbreviation, t]));

  console.log("Creating 2025 season...");
  const season = await prisma.season.upsert({
    where: { year: 2025 },
    update: {},
    create: { year: 2025, isCurrent: false },
  });

  console.log("Creating Week 15...");
  const week = await prisma.week.upsert({
    where: { seasonId_number: { seasonId: season.id, number: 15 } },
    update: { label: "Week 15" },
    create: { seasonId: season.id, number: 15, label: "Week 15", isCurrent: false },
  });

  console.log("Creating games...");
  for (const [awayAbbr, homeAbbr, gameTime] of WEEK15_GAMES) {
    const awayTeam = teamByAbbr[awayAbbr];
    const homeTeam = teamByAbbr[homeAbbr];
    if (!awayTeam || !homeTeam) {
      console.error(`Team not found: ${awayAbbr} or ${homeAbbr}`);
      continue;
    }
    const existing = await prisma.game.findFirst({
      where: { weekId: week.id, homeTeamId: homeTeam.id, awayTeamId: awayTeam.id },
    });
    if (!existing) {
      await prisma.game.create({
        data: {
          weekId: week.id,
          homeTeamId: homeTeam.id,
          awayTeamId: awayTeam.id,
          gameTime: new Date(gameTime),
        },
      });
    }
  }

  console.log("Creating team records...");
  const week15Abbrs = new Set(WEEK15_GAMES.flatMap(([a, h]) => [a, h]));
  for (const abbr of week15Abbrs) {
    const team = teamByAbbr[abbr];
    const record = RECORDS[abbr] ?? { wins: 0, losses: 0, ties: 0 };
    if (!team) continue;
    await prisma.teamRecord.upsert({
      where: { teamId_weekId: { teamId: team.id, weekId: week.id } },
      update: record,
      create: { teamId: team.id, weekId: week.id, ...record },
    });
  }

  console.log("Setting test mode to 2025 Week 15...");
  await prisma.appSettings.upsert({
    where: { id: "singleton" },
    update: { mode: "test", testSeasonId: season.id, testWeekId: week.id },
    create: { id: "singleton", mode: "test", testSeasonId: season.id, testWeekId: week.id },
  });

  console.log(`Done! Test mode is now pointing to 2025 Week 15 (id: ${week.id})`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
