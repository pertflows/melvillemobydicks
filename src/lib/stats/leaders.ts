/**
 * Pure leaderboard shaping. No database imports, so client components can use
 * this without dragging `next/headers` into the browser bundle.
 */

export type LeaderCategory =
  | 'batting_average' | 'home_runs' | 'rbi' | 'hits' | 'walks' | 'games' | 'ops';

export interface LeaderRow {
  playerId: string;
  slug: string;
  displayName: string;
  jerseyNumber: number | null;
  positionLabel: string | null;
  photoUrl: string | null;
  games: number;
  atBats: number | null;
  hits: number;
  doubles: number;
  triples: number;
  homeRuns: number;
  rbi: number;
  runs: number;
  walks: number;
  battingAverageDisplay: number | null;
  avgBasis: string | null;
  obp: number | null;
  slg: number | null;
  ops: number | null;
}

const COMPARATORS: Record<LeaderCategory, (a: LeaderRow, b: LeaderRow) => number> = {
  batting_average: (a, b) => (b.battingAverageDisplay ?? -1) - (a.battingAverageDisplay ?? -1),
  home_runs: (a, b) => b.homeRuns - a.homeRuns,
  rbi: (a, b) => b.rbi - a.rbi,
  hits: (a, b) => b.hits - a.hits,
  walks: (a, b) => b.walks - a.walks,
  games: (a, b) => b.games - a.games,
  ops: (a, b) => (b.ops ?? -1) - (a.ops ?? -1),
};

export function sortLeaders(rows: LeaderRow[], category: LeaderCategory): LeaderRow[] {
  return [...rows].sort(
    (a, b) => COMPARATORS[category](a, b) || a.displayName.localeCompare(b.displayName),
  );
}

/** Top N for a category, for the home page rails. */
export function topLeaders(rows: LeaderRow[], category: LeaderCategory, n = 5): LeaderRow[] {
  return sortLeaders(rows, category).slice(0, n);
}
