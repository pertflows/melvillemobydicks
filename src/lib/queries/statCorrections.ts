import { createClient } from '../supabase/server';
import {
  EMPTY_LINE, NOTHING_ENTERED,
  type StatCorrectionRow,
} from '../stats/corrections';

/**
 * The correction sheet for one game.
 *
 * Each row carries both numbers: what the play log counted, and what was
 * entered by hand against the paper book. The screen shows the entered value
 * where there is one and the counted value underneath, so it is always clear
 * which is which and what reverting would restore.
 *
 * The row and column types live in ../stats/corrections, which has no database
 * import, so the grid can use them in the browser.
 */

export {
  CORRECTABLE, EMPTY_LINE, NOTHING_ENTERED, isCorrected,
} from '../stats/corrections';
export type {
  CorrectableStat, StatLine, EnteredLine, StatCorrectionRow,
} from '../stats/corrections';

export interface StatCorrectionSheet {
  gameId: string;
  status: string;
  startsAt: string;
  opponentName: string | null;
  rows: StatCorrectionRow[];
}

export async function getStatCorrectionSheet(
  gameId: string,
): Promise<StatCorrectionSheet | null> {
  const db = await createClient();

  const { data: game } = await db
    .from('games')
    .select('id, status, starts_at, season_id, opponents(name)')
    .eq('id', gameId)
    .maybeSingle();

  if (!game) return null;

  const [{ data: derived }, { data: entered }, { data: lineup }] = await Promise.all([
    db
      .from('player_game_stats_derived')
      .select('player_id, ab, h, doubles, triples, hr, r, rbi, bb, k')
      .eq('game_id', gameId),
    db
      .from('game_stat_overrides')
      .select('player_id, ab, h, doubles, triples, hr, r, rbi, bb, k, note')
      .eq('game_id', gameId),
    db
      .from('game_lineups')
      .select('game_lineup_players(player_id, batting_order)')
      .eq('game_id', gameId)
      .maybeSingle(),
  ]);

  const orderByPlayer = new Map(
    (lineup?.game_lineup_players ?? []).map((p) => [p.player_id, p.batting_order]),
  );
  const derivedByPlayer = new Map(
    (derived ?? [])
      .filter((d): d is typeof d & { player_id: string } => d.player_id !== null)
      .map((d) => [d.player_id, d]),
  );
  const enteredByPlayer = new Map((entered ?? []).map((e) => [e.player_id, e]));

  // Anyone in the lineup, anyone with a recorded play, and anyone already
  // corrected: a correction may be the only trace a player was there at all.
  const playerIds = new Set<string>([
    ...orderByPlayer.keys(),
    ...derivedByPlayer.keys(),
    ...enteredByPlayer.keys(),
  ]);

  if (playerIds.size === 0) {
    return {
      gameId: game.id,
      status: game.status,
      startsAt: game.starts_at,
      opponentName: game.opponents?.name ?? null,
      rows: [],
    };
  }

  const [{ data: players }, { data: memberships }] = await Promise.all([
    db.from('players').select('id, display_name').in('id', [...playerIds]),
    db
      .from('player_seasons')
      .select('player_id, jersey_number')
      .eq('season_id', game.season_id)
      .in('player_id', [...playerIds]),
  ]);

  const nameByPlayer = new Map((players ?? []).map((p) => [p.id, p.display_name]));
  const jerseyByPlayer = new Map((memberships ?? []).map((m) => [m.player_id, m.jersey_number]));

  const rows: StatCorrectionRow[] = [...playerIds].map((playerId) => {
    const d = derivedByPlayer.get(playerId);
    const e = enteredByPlayer.get(playerId);

    return {
      playerId,
      displayName: nameByPlayer.get(playerId) ?? 'Unknown',
      jerseyNumber: jerseyByPlayer.get(playerId) ?? null,
      battingOrder: orderByPlayer.get(playerId) ?? null,
      derived: d
        ? { ab: d.ab ?? 0, h: d.h ?? 0, doubles: d.doubles ?? 0, triples: d.triples ?? 0,
            hr: d.hr ?? 0, r: d.r ?? 0, rbi: d.rbi ?? 0, bb: d.bb ?? 0, k: d.k ?? 0 }
        : { ...EMPTY_LINE },
      entered: e
        ? { ab: e.ab, h: e.h, doubles: e.doubles, triples: e.triples, hr: e.hr,
            r: e.r, rbi: e.rbi, bb: e.bb, k: e.k }
        : { ...NOTHING_ENTERED },
      note: e?.note ?? null,
    };
  });

  // Batting order first, then anyone who never made the lineup.
  rows.sort((a, b) => {
    if (a.battingOrder !== null && b.battingOrder !== null) return a.battingOrder - b.battingOrder;
    if (a.battingOrder !== null) return -1;
    if (b.battingOrder !== null) return 1;
    return a.displayName.localeCompare(b.displayName);
  });

  return {
    gameId: game.id,
    status: game.status,
    startsAt: game.starts_at,
    opponentName: game.opponents?.name ?? null,
    rows,
  };
}
