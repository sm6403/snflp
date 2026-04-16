/**
 * Auto-lock utilities for game-time-based pick locking.
 *
 * Two modes:
 *  - "all_before_first": lock all picks 5 min before the earliest game
 *  - "thursday_split": lock Thursday/early game(s) 5 min before their kickoff,
 *    then lock all remaining games 5 min before the first non-early game
 */

const LOCK_BUFFER_MS = 5 * 60 * 1000; // 5 minutes before kickoff
const MIN_GAP_MS = 24 * 60 * 60 * 1000; // 24-hour gap to detect Thursday vs Sunday

export type AutoLockMode = "off" | "all_before_first" | "thursday_split";

export interface GameSlot {
  id: string;
  gameTime: Date | null;
}

export interface GameSlotClassification {
  earlyGames: GameSlot[];
  mainGames: GameSlot[];
  earlyLockTime: Date | null; // earliest earlyGame.gameTime - 5min
  mainLockTime: Date | null; // earliest mainGame.gameTime - 5min
}

/**
 * Classify games into "early" (Thursday) and "main" (Sunday+) slots.
 *
 * Algorithm: sort by gameTime, find the largest gap between consecutive games.
 * If that gap is >= 24 hours, games before the gap are "early", after are "main".
 * If no gap >= 24h, all games are "main" (single-day slate or playoffs).
 */
export function classifyGameSlots(games: GameSlot[]): GameSlotClassification {
  const withTime = games
    .filter((g): g is GameSlot & { gameTime: Date } => g.gameTime != null)
    .sort((a, b) => a.gameTime.getTime() - b.gameTime.getTime());

  const noTime = games.filter((g) => g.gameTime == null);

  // Not enough games with times to split
  if (withTime.length < 2) {
    return {
      earlyGames: [],
      mainGames: games,
      earlyLockTime: null,
      mainLockTime: withTime.length > 0 ? new Date(withTime[0].gameTime.getTime() - LOCK_BUFFER_MS) : null,
    };
  }

  // Find the largest gap
  let maxGap = 0;
  let splitIndex = -1;
  for (let i = 1; i < withTime.length; i++) {
    const gap = withTime[i].gameTime.getTime() - withTime[i - 1].gameTime.getTime();
    if (gap > maxGap) {
      maxGap = gap;
      splitIndex = i;
    }
  }

  // If no gap >= 24 hours, all games are "main" (no Thursday split)
  if (maxGap < MIN_GAP_MS) {
    return {
      earlyGames: [],
      mainGames: games,
      earlyLockTime: null,
      mainLockTime: new Date(withTime[0].gameTime.getTime() - LOCK_BUFFER_MS),
    };
  }

  // Split into early and main
  const earlyWithTime = withTime.slice(0, splitIndex);
  const mainWithTime = withTime.slice(splitIndex);
  const earlyIds = new Set(earlyWithTime.map((g) => g.id));

  return {
    earlyGames: games.filter((g) => earlyIds.has(g.id)),
    mainGames: games.filter((g) => !earlyIds.has(g.id)),
    earlyLockTime: new Date(earlyWithTime[0].gameTime.getTime() - LOCK_BUFFER_MS),
    mainLockTime: mainWithTime.length > 0
      ? new Date(mainWithTime[0].gameTime.getTime() - LOCK_BUFFER_MS)
      : noTime.length > 0
        ? null // games without times can't be auto-locked
        : null,
  };
}

export interface AutoLockState {
  earlyLockTime: Date | null;
  mainLockTime: Date | null;
  earlyGameIds: string[];
  mainGameIds: string[];
}

/**
 * Compute auto-lock state for a given mode.
 */
export function computeAutoLockState(
  games: GameSlot[],
  mode: "all_before_first" | "thursday_split"
): AutoLockState {
  if (mode === "all_before_first") {
    const withTime = games
      .filter((g) => g.gameTime != null)
      .sort((a, b) => a.gameTime!.getTime() - b.gameTime!.getTime());

    const lockTime = withTime.length > 0
      ? new Date(withTime[0].gameTime!.getTime() - LOCK_BUFFER_MS)
      : null;

    return {
      earlyLockTime: null,
      mainLockTime: lockTime,
      earlyGameIds: [],
      mainGameIds: games.map((g) => g.id),
    };
  }

  // thursday_split
  const classification = classifyGameSlots(games);
  return {
    earlyLockTime: classification.earlyLockTime,
    mainLockTime: classification.mainLockTime,
    earlyGameIds: classification.earlyGames.map((g) => g.id),
    mainGameIds: classification.mainGames.map((g) => g.id),
  };
}
