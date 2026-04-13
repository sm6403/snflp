import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

// Week 16 games: [awayAbbr, homeAbbr, gameTimeUTC]
const WEEK16_GAMES: [string, string, string][] = [
  ["LAR", "SEA", "2025-12-19T18:15:00Z"], // Fri Dec 19 1:15pm ET
  ["PHI", "WSH", "2025-12-20T18:00:00Z"], // Sat Dec 20 1:00pm ET
  ["GB",  "CHI", "2025-12-20T21:30:00Z"], // Sat Dec 20 4:30pm ET
  ["BUF", "CLE", "2025-12-21T18:00:00Z"], // Sun Dec 21 1:00pm ET
  ["LAC", "DAL", "2025-12-21T18:00:00Z"],
  ["KC",  "TEN", "2025-12-21T18:00:00Z"],
  ["CIN", "MIA", "2025-12-21T18:00:00Z"],
  ["NYJ", "NO",  "2025-12-21T18:00:00Z"],
  ["MIN", "NYG", "2025-12-21T18:00:00Z"],
  ["TB",  "CAR", "2025-12-21T18:00:00Z"],
  ["JAX", "DEN", "2025-12-21T18:00:00Z"],
  ["ATL", "ARI", "2025-12-21T18:00:00Z"],
  ["PIT", "DET", "2025-12-21T21:05:00Z"], // Sun Dec 21 4:05pm ET
  ["LV",  "HOU", "2025-12-21T21:25:00Z"],
  ["NE",  "BAL", "2025-12-21T21:25:00Z"],
  ["SF",  "IND", "2025-12-23T00:15:00Z"], // Tue Dec 23
];

// Invented Week 16 standings (heading into the game)
const RECORDS: Record<string, { wins: number; losses: number; ties: number }> = {
  LAR: { wins: 10, losses: 4,  ties: 0 },
  SEA: { wins: 10, losses: 4,  ties: 0 },
  PHI: { wins: 12, losses: 2,  ties: 0 },
  WSH: { wins: 9,  losses: 5,  ties: 0 },
  GB:  { wins: 9,  losses: 5,  ties: 0 },
  CHI: { wins: 5,  losses: 9,  ties: 0 },
  BUF: { wins: 11, losses: 3,  ties: 0 },
  CLE: { wins: 3,  losses: 11, ties: 0 },
  LAC: { wins: 9,  losses: 5,  ties: 0 },
  DAL: { wins: 7,  losses: 7,  ties: 0 },
  KC:  { wins: 13, losses: 1,  ties: 0 },
  TEN: { wins: 3,  losses: 11, ties: 0 },
  CIN: { wins: 7,  losses: 7,  ties: 0 },
  MIA: { wins: 6,  losses: 8,  ties: 0 },
  NYJ: { wins: 4,  losses: 10, ties: 0 },
  NO:  { wins: 5,  losses: 9,  ties: 0 },
  MIN: { wins: 13, losses: 1,  ties: 0 },
  NYG: { wins: 3,  losses: 11, ties: 0 },
  TB:  { wins: 8,  losses: 6,  ties: 0 },
  CAR: { wins: 3,  losses: 11, ties: 0 },
  JAX: { wins: 4,  losses: 10, ties: 0 },
  DEN: { wins: 9,  losses: 5,  ties: 0 },
  ATL: { wins: 7,  losses: 7,  ties: 0 },
  ARI: { wins: 7,  losses: 7,  ties: 0 },
  PIT: { wins: 10, losses: 4,  ties: 0 },
  DET: { wins: 13, losses: 1,  ties: 0 },
  LV:  { wins: 3,  losses: 11, ties: 0 },
  HOU: { wins: 9,  losses: 5,  ties: 0 },
  NE:  { wins: 4,  losses: 10, ties: 0 },
  BAL: { wins: 10, losses: 4,  ties: 0 },
  SF:  { wins: 7,  losses: 7,  ties: 0 },
  IND: { wins: 8,  losses: 6,  ties: 0 },
};

async function main() {
  const allTeams = await prisma.team.findMany();
  if (allTeams.length === 0) {
    console.error("No teams found — run npx prisma db seed first.");
    process.exit(1);
  }
  const teamByAbbr = Object.fromEntries(allTeams.map((t) => [t.abbreviation, t]));

  // 2025 season should already exist from Week 15 seed
  const season = await prisma.season.upsert({
    where: { year_type: { year: 2025, type: "regular" } },
    update: {},
    create: { year: 2025, type: "regular", mode: "live", isCurrent: false },
  });

  console.log("Creating 2025 Week 16...");
  const week = await prisma.week.upsert({
    where: { seasonId_number: { seasonId: season.id, number: 16 } },
    update: { label: "Week 16" },
    create: { seasonId: season.id, number: 16, label: "Week 16", isCurrent: false },
  });

  console.log("Creating Week 16 games...");
  for (const [awayAbbr, homeAbbr, gameTime] of WEEK16_GAMES) {
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

  console.log("Creating team records for Week 16...");
  const week16Abbrs = new Set(WEEK16_GAMES.flatMap(([a, h]) => [a, h]));
  for (const abbr of week16Abbrs) {
    const team = teamByAbbr[abbr];
    const record = RECORDS[abbr] ?? { wins: 0, losses: 0, ties: 0 };
    if (!team) continue;
    await prisma.teamRecord.upsert({
      where: { teamId_weekId: { teamId: team.id, weekId: week.id } },
      update: record,
      create: { teamId: team.id, weekId: week.id, ...record },
    });
  }

  console.log(`Done! Week 16 seeded (id: ${week.id})`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
