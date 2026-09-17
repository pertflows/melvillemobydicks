import { createClient } from '../supabase/server';
import type { Half, PlateAppearanceRecord } from '../scoring/engine';

/** Everything the scorebook needs for one game, in a single read. */

export interface LineupEntry {
  playerId: string;
  displayName: string;
  jerseyNumber: number | null;
  battingOrder: number;
  position: string | null;
}

export interface ScorebookData {
  gameId: string;
  status: string;
  homeAway: 'home' | 'away';
  scheduledInnings: number;
  startsAt: string;
  opponentName: string | null;
  venueName: string | null;
  gameNumber: number;
  seriesKey: string | null;
  lineup: LineupEntry[];
  plateAppearances: PlateAppearanceRecord[];
  inningRuns: { inning: number; theirRuns: number }[];
  /** Resolved linescore rows, with override vs derived visible. */
  innings: {
    inning: number;
    ourRuns: number;
    theirRuns: number;
    ourRunsOverride: number | null;
    derivedOurRuns: number;
  }[];
}

export async function getScorebook(gameId: string): Promise<ScorebookData | null> {
  const db = await createClient();

  const { data: game } = await db
    .from('games')
    .select('id, status, home_away, scheduled_innings, starts_at, game_number, series_key, opponents(name), venues(display_name)')
    .eq('id', gameId)
    .maybeSingle();

  if (!game) return null;

  const [{ data: lineup }, { data: pas }, { data: innings }] = await Promise.all([
    db
      .from('game_lineups')
      .select('id, game_lineup_players(player_id, batting_order, position, is_starter, players(display_name))')
      .eq('game_id', gameId)
      .maybeSingle(),
    db
      .from('plate_appearances')
      .select('id, sequence, inning, half, batter_id, lineup_spot, result_code, outs_before, outs_on_play, base_runner_movements(runner_id, start_base, end_base, is_out, rbi_credited)')
      .eq('game_id', gameId)
      .order('sequence'),
    db
      .from('game_inning_runs')
      .select('inning, our_runs, their_runs, our_runs_override, derived_our_runs')
      .eq('game_id', gameId)
      .order('inning'),
  ]);

  // Jersey numbers come from the season roster, not the lineup row.
  const playerIds = (lineup?.game_lineup_players ?? []).map((p) => p.player_id);
  const jerseyByPlayer = new Map<string, number | null>();

  if (playerIds.length > 0) {
    const { data: memberships } = await db
      .from('player_seasons')
      .select('player_id, jersey_number, seasons(is_current)')
      .in('player_id', playerIds);
    for (const m of memberships ?? []) {
      if (m.seasons?.is_current) jerseyByPlayer.set(m.player_id, m.jersey_number);
    }
  }

  return {
    gameId: game.id,
    status: game.status,
    homeAway: game.home_away,
    scheduledInnings: game.scheduled_innings,
    startsAt: game.starts_at,
    opponentName: game.opponents?.name ?? null,
    venueName: game.venues?.display_name ?? null,
    gameNumber: game.game_number,
    seriesKey: game.series_key,
    lineup: (lineup?.game_lineup_players ?? [])
      .filter((p) => p.is_starter)
      .sort((a, b) => a.batting_order - b.batting_order)
      .map((p) => ({
        playerId: p.player_id,
        displayName: p.players?.display_name ?? 'Unknown',
        jerseyNumber: jerseyByPlayer.get(p.player_id) ?? null,
        battingOrder: p.batting_order,
        position: p.position,
      })),
    plateAppearances: (pas ?? []).map((pa) => ({
      id: pa.id,
      sequence: pa.sequence,
      inning: pa.inning,
      half: pa.half as Half,
      batterId: pa.batter_id,
      lineupSpot: pa.lineup_spot,
      resultCode: pa.result_code,
      outsBefore: pa.outs_before,
      outsOnPlay: pa.outs_on_play,
      movements: (pa.base_runner_movements ?? []).map((m) => ({
        runnerId: m.runner_id,
        startBase: m.start_base as 0 | 1 | 2 | 3,
        endBase: m.end_base as 1 | 2 | 3 | 4 | null,
        isOut: m.is_out,
        rbiCredited: m.rbi_credited,
      })),
    })),
    inningRuns: (innings ?? [])
      .filter((i): i is typeof i & { inning: number } => i.inning !== null)
      .map((i) => ({ inning: i.inning, theirRuns: i.their_runs ?? 0 })),
    innings: (innings ?? [])
      .filter((i): i is typeof i & { inning: number } => i.inning !== null)
      .map((i) => ({
        inning: i.inning,
        ourRuns: i.our_runs ?? 0,
        theirRuns: i.their_runs ?? 0,
        ourRunsOverride: i.our_runs_override,
        derivedOurRuns: i.derived_our_runs ?? 0,
      })),
  };
}

/** Outcome buttons, ordered for the scorebook keypad. */
export async function getResultTypes() {
  const db = await createClient();
  const { data } = await db
    .from('pa_result_types')
    .select('code, label, short_label, counts_as_ab, is_hit, total_bases, is_walk, is_hbp, is_strikeout, is_sac_fly, is_sac_bunt, is_error, is_fielders_choice, batter_reaches, default_outs')
    .eq('is_active', true)
    .order('sort_order');
  return data ?? [];
}

/** The other game of a doubleheader, so its lineup can be reused. */
export async function getSiblingGame(gameId: string, seriesKey: string | null) {
  if (!seriesKey) return null;
  const db = await createClient();
  const { data } = await db
    .from('games')
    .select('id, game_number, game_lineups(id)')
    .eq('series_key', seriesKey)
    .neq('id', gameId)
    .order('game_number');

  const withLineup = (data ?? []).find((g) => g.game_lineups);
  return withLineup ? { id: withLineup.id, gameNumber: withLineup.game_number } : null;
}
