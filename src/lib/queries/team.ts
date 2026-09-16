import { createClient } from '../supabase/server';

export interface TeamRecord {
  wins: number;
  losses: number;
  ties: number;
  gamesPlayed: number;
  runsScored: number;
  runsAllowed: number;
  runDifferential: number;
}

const EMPTY: TeamRecord = {
  wins: 0, losses: 0, ties: 0, gamesPlayed: 0,
  runsScored: 0, runsAllowed: 0, runDifferential: 0,
};

/**
 * Win/loss record for a season, derived from game results rather than stored.
 */
export async function getTeamRecord(seasonId: string): Promise<TeamRecord> {
  const db = await createClient();
  const { data, error } = await db
    .from('team_season_record')
    .select('wins, losses, ties, games_played, runs_scored, runs_allowed')
    .eq('season_id', seasonId)
    .maybeSingle();

  if (error) throw new Error(`getTeamRecord: ${error.message}`);
  if (!data) return EMPTY;

  const runsScored = data.runs_scored ?? 0;
  const runsAllowed = data.runs_allowed ?? 0;

  return {
    wins: data.wins ?? 0,
    losses: data.losses ?? 0,
    ties: data.ties ?? 0,
    gamesPlayed: data.games_played ?? 0,
    runsScored,
    runsAllowed,
    runDifferential: runsScored - runsAllowed,
  };
}
