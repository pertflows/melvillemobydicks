import { createClient } from '../supabase/server';
import { playerPhotoUrl } from '../storage';
import type { LeaderRow } from '../stats/leaders';

/**
 * Leaderboard reads.
 *
 * Sorting lives in ../stats/leaders so client components can import it without
 * pulling this server-only module into the browser bundle.
 */

export type { LeaderCategory, LeaderRow } from '../stats/leaders';
export { sortLeaders, topLeaders } from '../stats/leaders';

export async function getSeasonLeaderboard(seasonId: string): Promise<LeaderRow[]> {
  const db = await createClient();

  const [{ data: stats, error }, { data: memberships }] = await Promise.all([
    db
      .from('player_season_stats')
      .select(
        'player_id, g, ab, r, h, doubles, triples, hr, rbi, bb, batting_average_display, batting_average_basis, obp, slg, ops',
      )
      .eq('season_id', seasonId),
    db
      .from('player_seasons')
      .select('player_id, jersey_number, players(slug, display_name, photo_path, legacy_position_label), positions(label)')
      .eq('season_id', seasonId),
  ]);

  if (error) throw new Error(`getSeasonLeaderboard: ${error.message}`);

  const memberByPlayer = new Map((memberships ?? []).map((m) => [m.player_id, m]));

  return (stats ?? [])
    .filter((s): s is typeof s & { player_id: string } => s.player_id !== null)
    .map((s) => {
      const m = memberByPlayer.get(s.player_id);
      const p = m?.players;
      return {
        playerId: s.player_id,
        slug: p?.slug ?? '',
        displayName: p?.display_name ?? 'Unknown',
        jerseyNumber: m?.jersey_number ?? null,
        positionLabel: m?.positions?.label ?? p?.legacy_position_label ?? null,
        photoUrl: playerPhotoUrl(p?.photo_path),
        games: s.g ?? 0,
        atBats: s.ab,
        hits: s.h ?? 0,
        doubles: s.doubles ?? 0,
        triples: s.triples ?? 0,
        homeRuns: s.hr ?? 0,
        rbi: s.rbi ?? 0,
        runs: s.r ?? 0,
        walks: s.bb ?? 0,
        battingAverageDisplay:
          s.batting_average_display === null ? null : Number(s.batting_average_display),
        avgBasis: s.batting_average_basis,
        obp: s.obp === null ? null : Number(s.obp),
        slg: s.slg === null ? null : Number(s.slg),
        ops: s.ops === null ? null : Number(s.ops),
      };
    })
    .filter((r) => r.slug);
}
