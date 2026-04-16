export interface TeamColors {
  /** ESPN team ID — matches TEAM_LOGO_IDS in nfl-teams.ts, used as data-team-theme value */
  espnId: string;
  /** Primary accent hex — replaces indigo-600 */
  primary: string;
  /** Hover-state hex — replaces indigo-500 (slightly darker) */
  hover: string;
  /** Light variant hex — replaces indigo-400 (for text/muted accents) */
  light: string;
}

/**
 * Official NFL team colour map keyed by full team name (matches NFL_TEAMS array).
 * For teams with very dark primaries (Raiders black, Bears navy, etc.) the
 * brighter secondary colour is used so it remains visible on dark backgrounds.
 */
export const NFL_TEAM_COLORS: Record<string, TeamColors> = {
  "Arizona Cardinals":    { espnId: "ari", primary: "#97233F", hover: "#7a1c33", light: "#c24060" },
  "Atlanta Falcons":      { espnId: "atl", primary: "#A71930", hover: "#8a1427", light: "#d44050" },
  "Baltimore Ravens":     { espnId: "bal", primary: "#9E7C0C", hover: "#7e6309", light: "#c9a030" },
  "Buffalo Bills":        { espnId: "buf", primary: "#00338D", hover: "#002a73", light: "#1a5abf" },
  "Carolina Panthers":    { espnId: "car", primary: "#0085CA", hover: "#006ba3", light: "#33a3e0" },
  "Chicago Bears":        { espnId: "chi", primary: "#C83803", hover: "#a32e02", light: "#f05020" },
  "Cincinnati Bengals":   { espnId: "cin", primary: "#FB4F14", hover: "#d94010", light: "#fc7040" },
  "Cleveland Browns":     { espnId: "cle", primary: "#FF3C00", hover: "#d93200", light: "#ff6633" },
  "Dallas Cowboys":       { espnId: "dal", primary: "#869397", hover: "#6b777c", light: "#a5b0b4" },
  "Denver Broncos":       { espnId: "den", primary: "#FB4F14", hover: "#d94010", light: "#fc7040" },
  "Detroit Lions":        { espnId: "det", primary: "#0076B6", hover: "#005f92", light: "#2295d4" },
  "Green Bay Packers":    { espnId: "gb",  primary: "#FFB612", hover: "#e09e0f", light: "#ffc93d" },
  "Houston Texans":       { espnId: "hou", primary: "#A71930", hover: "#8a1427", light: "#d44050" },
  "Indianapolis Colts":   { espnId: "ind", primary: "#002C5F", hover: "#00234c", light: "#1a4f8c" },
  "Jacksonville Jaguars": { espnId: "jax", primary: "#D7A22A", hover: "#b88722", light: "#e8bc50" },
  "Kansas City Chiefs":   { espnId: "kc",  primary: "#E31837", hover: "#c2152e", light: "#f04060" },
  "Las Vegas Raiders":    { espnId: "lv",  primary: "#A5ACAF", hover: "#858d91", light: "#c2c8cb" },
  "Los Angeles Chargers": { espnId: "lac", primary: "#0080C6", hover: "#0067a0", light: "#22a0e8" },
  "Los Angeles Rams":     { espnId: "lar", primary: "#003594", hover: "#002a77", light: "#1a55c0" },
  "Miami Dolphins":       { espnId: "mia", primary: "#008E97", hover: "#00737a", light: "#00b0bb" },
  "Minnesota Vikings":    { espnId: "min", primary: "#4F2683", hover: "#3e1c68", light: "#7040aa" },
  "New England Patriots": { espnId: "ne",  primary: "#C60C30", hover: "#a00a28", light: "#e83050" },
  "New Orleans Saints":   { espnId: "no",  primary: "#D3BC8D", hover: "#b89e6e", light: "#e8d4a8" },
  "New York Giants":      { espnId: "nyg", primary: "#0B2265", hover: "#081a51", light: "#1a3d8c" },
  "New York Jets":        { espnId: "nyj", primary: "#125740", hover: "#0e4332", light: "#1a7a59" },
  "Philadelphia Eagles":  { espnId: "phi", primary: "#004C54", hover: "#003840", light: "#007080" },
  "Pittsburgh Steelers":  { espnId: "pit", primary: "#FFB612", hover: "#e09e0f", light: "#ffc93d" },
  "San Francisco 49ers":  { espnId: "sf",  primary: "#AA0000", hover: "#8c0000", light: "#d41010" },
  "Seattle Seahawks":     { espnId: "sea", primary: "#69BE28", hover: "#55991f", light: "#88d44a" },
  "Tampa Bay Buccaneers": { espnId: "tb",  primary: "#D50A0A", hover: "#b20808", light: "#f03030" },
  "Tennessee Titans":     { espnId: "ten", primary: "#4B92DB", hover: "#3478bf", light: "#72aee8" },
  "Washington Commanders":{ espnId: "wsh", primary: "#5A1414", hover: "#470f0f", light: "#802020" },
};

export function getTeamColors(teamName: string): TeamColors | null {
  return NFL_TEAM_COLORS[teamName] ?? null;
}
