'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { getSessionUser } from '@/lib/auth/session';
import {
  defaultAdvancement, outsFromMovements, rbisFromMovements, runsFromMovements,
  type ResultType, type RunnerMovement,
} from '@/lib/scoring/engine';
import type { ActionState } from './roster';

export type { ActionState };

/**
 * Live scorekeeping.
 *
 * Every recorded play writes a plate appearance plus its runner movements, and
 * nothing else. Scores, statistics and the base state are all derived from
 * those rows, so there is no aggregate to keep in sync and undo is simply a
 * delete of the last appearance.
 *
 * Scorekeepers as well as admins may call these; row level security enforces it.
 */

async function assertScorer(): Promise<string | null> {
  const user = await getSessionUser();
  if (!user) return 'You are not signed in.';
  if (user.role !== 'admin' && user.role !== 'scorekeeper') {
    return 'You do not have permission to score games.';
  }
  return null;
}

function revalidateGame(gameId: string) {
  revalidatePath(`/admin/live/${gameId}`);
  revalidatePath(`/schedule/${gameId}`);
  revalidatePath('/schedule');
  revalidatePath('/');
}

/** Saves the batting order and defensive positions for a game. */
export async function saveLineup(
  gameId: string,
  entries: { playerId: string; battingOrder: number; position: string | null }[],
): Promise<ActionState> {
  const denied = await assertScorer();
  if (denied) return { error: denied };
  if (entries.length === 0) return { error: 'Add at least one batter.' };

  const db = await createClient();

  const { data: lineup, error: lineupError } = await db
    .from('game_lineups')
    .upsert({ game_id: gameId }, { onConflict: 'game_id' })
    .select('id')
    .single();

  if (lineupError) return { error: `Could not save the lineup: ${lineupError.message}` };

  // Replace wholesale: the pregame screen always submits the full order.
  await db.from('game_lineup_players').delete().eq('lineup_id', lineup.id);

  const { error } = await db.from('game_lineup_players').insert(
    entries.map((e) => ({
      lineup_id: lineup.id,
      player_id: e.playerId,
      batting_order: e.battingOrder,
      position: e.position,
      is_starter: true,
    })),
  );

  if (error) return { error: `Could not save the batting order: ${error.message}` };

  revalidateGame(gameId);
  return { success: 'Lineup saved.' };
}

/** Copies another game's lineup, for the second game of a doubleheader. */
export async function copyLineupFrom(
  targetGameId: string,
  sourceGameId: string,
): Promise<ActionState> {
  const denied = await assertScorer();
  if (denied) return { error: denied };

  const db = await createClient();

  const { data: source } = await db
    .from('game_lineups')
    .select('id, game_lineup_players(player_id, batting_order, position)')
    .eq('game_id', sourceGameId)
    .maybeSingle();

  if (!source?.game_lineup_players?.length) {
    return { error: 'That game has no lineup to copy.' };
  }

  return saveLineup(
    targetGameId,
    source.game_lineup_players
      .sort((a, b) => a.batting_order - b.batting_order)
      .map((p) => ({
        playerId: p.player_id,
        battingOrder: p.batting_order,
        position: p.position,
      })),
  );
}

export async function startGame(gameId: string): Promise<ActionState> {
  const denied = await assertScorer();
  if (denied) return { error: denied };

  const db = await createClient();
  const { error } = await db
    .from('games')
    .update({
      status: 'live',
      live_started_at: new Date().toISOString(),
      current_inning: 1,
      current_outs: 0,
    })
    .eq('id', gameId);

  if (error) return { error: error.message };

  await db.from('game_events').insert({
    game_id: gameId, event_type: 'game_start', description: 'Game started', inning: 1,
  });

  revalidateGame(gameId);
  return { success: 'Game started.' };
}

export interface RecordPlayInput {
  gameId: string;
  batterId: string;
  lineupSpot: number;
  inning: number;
  half: 'top' | 'bottom';
  outsBefore: number;
  resultCode: string;
  bases: [string | null, string | null, string | null];
  /** Supplied when the scorekeeper adjusted the default advancement. */
  movements?: RunnerMovement[];
}

/**
 * Records one plate appearance and its runner movements.
 *
 * The movements are computed from the outcome by default, which is what makes
 * one-tap scoring possible; the caller may override them when a play was
 * unusual.
 */
export async function recordPlay(input: RecordPlayInput): Promise<ActionState> {
  const denied = await assertScorer();
  if (denied) return { error: denied };

  const db = await createClient();

  const { data: resultRow, error: resultError } = await db
    .from('pa_result_types')
    .select('*')
    .eq('code', input.resultCode)
    .single();

  if (resultError || !resultRow) return { error: `Unknown outcome ${input.resultCode}.` };

  const result: ResultType = {
    code: resultRow.code,
    label: resultRow.label,
    shortLabel: resultRow.short_label,
    countsAsAb: resultRow.counts_as_ab,
    isHit: resultRow.is_hit,
    totalBases: resultRow.total_bases,
    isWalk: resultRow.is_walk,
    isHbp: resultRow.is_hbp,
    isStrikeout: resultRow.is_strikeout,
    isSacFly: resultRow.is_sac_fly,
    isSacBunt: resultRow.is_sac_bunt,
    isError: resultRow.is_error,
    isFieldersChoice: resultRow.is_fielders_choice,
    batterReaches: resultRow.batter_reaches,
    defaultOuts: resultRow.default_outs,
  };

  const movements =
    input.movements ?? defaultAdvancement(result, input.bases, input.batterId);

  // Sequence numbers keep the log totally ordered, which the replay relies on.
  const { data: last } = await db
    .from('plate_appearances')
    .select('sequence')
    .eq('game_id', input.gameId)
    .order('sequence', { ascending: false })
    .limit(1)
    .maybeSingle();

  const sequence = (last?.sequence ?? 0) + 1;
  const outsOnPlay = outsFromMovements(movements);

  const { data: pa, error } = await db
    .from('plate_appearances')
    .insert({
      game_id: input.gameId,
      batting_team: 'us',
      batter_id: input.batterId,
      inning: input.inning,
      half: input.half,
      sequence,
      lineup_spot: input.lineupSpot,
      result_code: input.resultCode,
      outs_before: Math.min(input.outsBefore, 2),
      outs_on_play: outsOnPlay,
    })
    .select('id')
    .single();

  if (error) return { error: `Could not record the play: ${error.message}` };

  if (movements.length > 0) {
    const { error: moveError } = await db.from('base_runner_movements').insert(
      movements.map((m) => ({
        plate_appearance_id: pa.id,
        runner_id: m.runnerId,
        start_base: m.startBase,
        end_base: m.endBase,
        is_out: m.isOut,
        rbi_credited: m.rbiCredited,
      })),
    );

    if (moveError) {
      // Keep the log consistent rather than leaving a play with no runners.
      await db.from('plate_appearances').delete().eq('id', pa.id);
      return { error: `Could not record runners: ${moveError.message}` };
    }
  }

  const runs = runsFromMovements(movements);
  const rbi = rbisFromMovements(movements);

  await db.from('game_events').insert({
    game_id: input.gameId,
    event_type: 'plate_appearance',
    inning: input.inning,
    half: input.half,
    plate_appearance_id: pa.id,
    description: `${result.label}${runs > 0 ? ` (${runs} run${runs > 1 ? 's' : ''})` : ''}`,
    payload: { resultCode: result.code, runs, rbi },
  });

  revalidateGame(input.gameId);
  return { success: result.label };
}

/** Removes the most recent play. The log is the state, so this is the undo. */
export async function undoLastPlay(gameId: string): Promise<ActionState> {
  const denied = await assertScorer();
  if (denied) return { error: denied };

  const db = await createClient();
  const { data: last } = await db
    .from('plate_appearances')
    .select('id, sequence')
    .eq('game_id', gameId)
    .order('sequence', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!last) return { error: 'Nothing to undo.' };

  // Runner movements and the linked event cascade with the appearance.
  const { error } = await db.from('plate_appearances').delete().eq('id', last.id);
  if (error) return { error: `Could not undo: ${error.message}` };

  revalidateGame(gameId);
  return { success: 'Last play removed.' };
}

/** Records the opponent's runs for an inning. */
export async function setOpponentRuns(
  gameId: string,
  inning: number,
  theirRuns: number,
): Promise<ActionState> {
  const denied = await assertScorer();
  if (denied) return { error: denied };

  const db = await createClient();
  const { error } = await db
    .from('game_innings')
    .upsert(
      { game_id: gameId, inning, their_runs: Math.max(0, theirRuns) },
      { onConflict: 'game_id,inning' },
    );

  if (error) return { error: `Could not save: ${error.message}` };

  revalidateGame(gameId);
  return { success: 'Saved.' };
}

/** Closes the game out. Scores stay derived; only the status changes. */
export async function finalizeGame(gameId: string, isMercy = false): Promise<ActionState> {
  const denied = await assertScorer();
  if (denied) return { error: denied };

  const db = await createClient();
  const { error } = await db
    .from('games')
    .update({ status: 'final', finalized_at: new Date().toISOString(), is_mercy: isMercy })
    .eq('id', gameId);

  if (error) return { error: error.message };

  await db.from('game_events').insert({
    game_id: gameId, event_type: 'game_final', description: 'Final',
  });

  revalidateGame(gameId);
  return { success: 'Game finalised.' };
}
