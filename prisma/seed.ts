import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

const TEAMS = [
  { name: "Arizona Cardinals",     abbreviation: "ARI", espnId: "ari" },
  { name: "Atlanta Falcons",       abbreviation: "ATL", espnId: "atl" },
  { name: "Baltimore Ravens",      abbreviation: "BAL", espnId: "bal" },
  { name: "Buffalo Bills",         abbreviation: "BUF", espnId: "buf" },
  { name: "Carolina Panthers",     abbreviation: "CAR", espnId: "car" },
  { name: "Chicago Bears",         abbreviation: "CHI", espnId: "chi" },
  { name: "Cincinnati Bengals",    abbreviation: "CIN", espnId: "cin" },
  { name: "Cleveland Browns",      abbreviation: "CLE", espnId: "cle" },
  { name: "Dallas Cowboys",        abbreviation: "DAL", espnId: "dal" },
  { name: "Denver Broncos",        abbreviation: "DEN", espnId: "den" },
  { name: "Detroit Lions",         abbreviation: "DET", espnId: "det" },
  { name: "Green Bay Packers",     abbreviation: "GB",  espnId: "gb"  },
  { name: "Houston Texans",        abbreviation: "HOU", espnId: "hou" },
  { name: "Indianapolis Colts",    abbreviation: "IND", espnId: "ind" },
  { name: "Jacksonville Jaguars",  abbreviation: "JAX", espnId: "jax" },
  { name: "Kansas City Chiefs",    abbreviation: "KC",  espnId: "kc"  },
  { name: "Las Vegas Raiders",     abbreviation: "LV",  espnId: "lv"  },
  { name: "Los Angeles Chargers",  abbreviation: "LAC", espnId: "lac" },
  { name: "Los Angeles Rams",      abbreviation: "LAR", espnId: "lar" },
  { name: "Miami Dolphins",        abbreviation: "MIA", espnId: "mia" },
  { name: "Minnesota Vikings",     abbreviation: "MIN", espnId: "min" },
  { name: "New England Patriots",  abbreviation: "NE",  espnId: "ne"  },
  { name: "New Orleans Saints",    abbreviation: "NO",  espnId: "no"  },
  { name: "New York Giants",       abbreviation: "NYG", espnId: "nyg" },
  { name: "New York Jets",         abbreviation: "NYJ", espnId: "nyj" },
  { name: "Philadelphia Eagles",   abbreviation: "PHI", espnId: "phi" },
  { name: "Pittsburgh Steelers",   abbreviation: "PIT", espnId: "pit" },
  { name: "San Francisco 49ers",   abbreviation: "SF",  espnId: "sf"  },
  { name: "Seattle Seahawks",      abbreviation: "SEA", espnId: "sea" },
  { name: "Tampa Bay Buccaneers",  abbreviation: "TB",  espnId: "tb"  },
  { name: "Tennessee Titans",      abbreviation: "TEN", espnId: "ten" },
  { name: "Washington Commanders", abbreviation: "WSH", espnId: "wsh" },
];

// Week 1 2024 matchups: [awayAbbr, homeAbbr, gameTimeUTC]
const WEEK1_GAMES: [string, string, string][] = [
  ["BAL", "KC",  "2024-09-06T00:20:00Z"], // Thu Sep 5 8:20pm ET
  ["GB",  "PHI", "2024-09-07T00:15:00Z"], // Fri Sep 6 8:15pm ET
  ["ATL", "PIT", "2024-09-08T17:00:00Z"], // Sun Sep 8 1:00pm ET
  ["CIN", "NE",  "2024-09-08T17:00:00Z"], // Sun Sep 8 1:00pm ET
  ["NYG", "MIN", "2024-09-08T17:00:00Z"], // Sun Sep 8 1:00pm ET
  ["ARI", "BUF", "2024-09-08T17:00:00Z"], // Sun Sep 8 1:00pm ET
  ["DET", "LAR", "2024-09-08T20:05:00Z"], // Sun Sep 8 4:05pm ET
  ["NYJ", "SF",  "2024-09-08T20:25:00Z"], // Sun Sep 8 4:25pm ET
  ["CLE", "DAL", "2024-09-08T20:25:00Z"], // Sun Sep 8 4:25pm ET
  ["IND", "HOU", "2024-09-09T00:20:00Z"], // Sun Sep 8 8:20pm ET
];

async function main() {
  console.log("Seeding teams...");
  for (const team of TEAMS) {
    await prisma.team.upsert({
      where: { espnId: team.espnId },
      update: { name: team.name, abbreviation: team.abbreviation },
      create: team,
    });
  }

  console.log("Seeding 2024 season...");
  const season = await prisma.season.upsert({
    where: { year_type: { year: 2024, type: "regular" } },
    update: { isCurrent: true },
    create: { year: 2024, type: "regular", mode: "live", isCurrent: true },
  });

  console.log("Seeding Week 1...");
  const week = await prisma.week.upsert({
    where: { seasonId_number: { seasonId: season.id, number: 1 } },
    update: { isCurrent: true, label: "Week 1" },
    create: { seasonId: season.id, number: 1, label: "Week 1", isCurrent: true },
  });

  console.log("Seeding Week 1 games...");
  const allTeams = await prisma.team.findMany();
  const teamByAbbr = Object.fromEntries(allTeams.map((t) => [t.abbreviation, t]));

  for (const [awayAbbr, homeAbbr, gameTime] of WEEK1_GAMES) {
    const awayTeam = teamByAbbr[awayAbbr];
    const homeTeam = teamByAbbr[homeAbbr];
    if (!awayTeam || !homeTeam) {
      console.error(`Team not found: ${awayAbbr} or ${homeAbbr}`);
      continue;
    }
    // Upsert: identify by weekId + homeTeamId + awayTeamId
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

  console.log("Seeding team records for Week 1 (all 0-0-0)...");
  const week1TeamAbbrs = new Set(WEEK1_GAMES.flatMap(([a, h]) => [a, h]));
  for (const abbr of week1TeamAbbrs) {
    const team = teamByAbbr[abbr];
    if (!team) continue;
    await prisma.teamRecord.upsert({
      where: { teamId_weekId: { teamId: team.id, weekId: week.id } },
      update: {},
      create: { teamId: team.id, weekId: week.id, wins: 0, losses: 0, ties: 0 },
    });
  }

  console.log("Seeding AppSettings...");
  await prisma.appSettings.upsert({
    where: { id: "singleton" },
    update: {},
    create: { id: "singleton", mode: "live", testSeasonId: null, testWeekId: null },
  });

  console.log("Seed complete.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
