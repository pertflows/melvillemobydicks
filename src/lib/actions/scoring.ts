'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { getSessionUser } from '@/lib/auth/session';
import {
  defaultAdvancement, outsFromMovements, rbisFromMovements, replayGame, runsFromMovements,
  type ResultType, type RunnerMovement,
} from '@/lib/scoring/engine';
import { getScorebook, type ScorebookData } from '@/lib/queries/scoring';
import { formatInning, formatOuts, ordinal } from '@/lib/format';
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

/**
 * Saves the batting order and defensive positions.
 *
 * The full order is always submitted, so the rows are replaced wholesale. That
 * is safe mid-game: plate appearances reference the player and the batting
 * spot directly, never the lineup row, so rewriting the lineup never orphans a
 * recorded play or loses anybody's statistics.
 *
 * When a game is already under way, players who were not in the lineup before
 * are recorded as entering in the current inning, and anyone dropped is logged
 * as a substitution so the change is visible afterwards.
 */
export async function saveLineup(
  gameId: string,
  entries: { playerId: string; battingOrder: number; position: string | null }[],
  options: { currentInning?: number } = {},
): Promise<ActionState> {
  const denied = await assertScorer();
  if (denied) return { error: denied };
  if (entries.length === 0) return { error: 'Add at least one batter.' };

  const duplicates = entries.length !== new Set(entries.map((e) => e.playerId)).size;
  if (duplicates) return { error: 'A player can only appear once in the order.' };

  // Spots are 1..n with no gaps, whatever the caller sent. A gap would leave a
  // recorded lineup_spot pointing at nobody.
  const ordered = [...entries]
    .sort((a, b) => a.battingOrder - b.battingOrder)
    .map((e, i) => ({ ...e, battingOrder: i + 1 }));

  const db = await createClient();

  const { data: lineup, error: lineupError } = await db
    .from('game_lineups')
    .upsert({ game_id: gameId }, { onConflict: 'game_id' })
    .select('id')
    .single();

  if (lineupError) return { error: `Could not save the lineup: ${lineupError.message}` };

  // Keep each player's original entry inning across a rewrite.
  const { data: previous } = await db
    .from('game_lineup_players')
    .select('player_id, entered_inning, is_starter')
    .eq('lineup_id', lineup.id);

  const before = new Map(
    (previous ?? []).map((p) => [p.player_id, p]),
  );

  // Whether someone is a starter turns on whether the game has begun, not on
  // whether the lineup happened to be empty: a name added during pregame is
  // still a starter, however many times the order was saved before it.
  const { data: gameRow } = await db
    .from('games')
    .select('status')
    .eq('id', gameId)
    .maybeSingle();

  const underway = gameRow?.status === 'live' || gameRow?.status === 'final';
  const inning = options.currentInning;

  await db.from('game_lineup_players').delete().eq('lineup_id', lineup.id);

  const { error } = await db.from('game_lineup_players').insert(
    ordered.map((e) => {
      const prior = before.get(e.playerId);
      return {
        lineup_id: lineup.id,
        player_id: e.playerId,
        batting_order: e.battingOrder,
        position: e.position,
        // Anyone already there keeps their standing; a new name mid-game is a
        // substitute who entered this inning.
        is_starter: prior ? prior.is_starter : !underway,
        entered_inning: prior ? prior.entered_inning : underway ? (inning ?? null) : null,
      };
    }),
  );

  if (error) return { error: `Could not save the batting order: ${error.message}` };

  // Record the change once the game is under way, so it is auditable later.
  if (underway && before.size > 0) {
    const added = ordered.filter((e) => !before.has(e.playerId)).length;
    const removed = [...before.keys()].filter(
      (id) => !ordered.some((e) => e.playerId === id),
    ).length;

    if (added > 0 || removed > 0) {
      await db.from('game_events').insert({
        game_id: gameId,
        event_type: 'substitution',
        inning: inning ?? null,
        description:
          [added > 0 ? `${added} in` : null, removed > 0 ? `${removed} out` : null]
            .filter(Boolean)
            .join(', ') || 'Lineup changed',
      });
    }
  }

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

  // Move the public live banner's cursor on. The inning and outs supplied here
  // are the replayed ones already, so this needs no second read of the log.
  const outsAfter = Math.min(input.outsBefore, 2) + outsOnPlay;
  await db
    .from('games')
    .update(
      outsAfter >= 3
        ? { current_inning: input.inning + 1, current_half: input.half, current_outs: 0 }
        : { current_inning: input.inning, current_half: input.half, current_outs: outsAfter },
    )
    .eq('id', input.gameId);

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

  await syncLiveCursor(gameId);
  revalidateGame(gameId);
  return { success: 'Last play removed.' };
}

/** Records the opponent's runs for an inning. */
export async function setOpponentRuns(
  gameId: string,
  inning: number,
  theirRuns: number,
): Promise<ActionState> {
  return setInningRuns(gameId, inning, { theirRuns });
}

/**
 * Edits one inning of the linescore.
 *
 * Our runs are normally derived from the play log. Passing `ourRuns` writes a
 * deliberate override for that inning; passing null clears it back to derived.
 * Leave it undefined to touch only the opponent.
 */
export async function setInningRuns(
  gameId: string,
  inning: number,
  values: { ourRuns?: number | null; theirRuns?: number },
): Promise<ActionState> {
  const denied = await assertScorer();
  if (denied) return { error: denied };
  if (inning < 1) return { error: 'Inning must be 1 or greater.' };

  const db = await createClient();

  const { data: existing } = await db
    .from('game_innings')
    .select('our_runs, their_runs')
    .eq('game_id', gameId)
    .eq('inning', inning)
    .maybeSingle();

  const row = {
    game_id: gameId,
    inning,
    our_runs:
      values.ourRuns === undefined
        ? (existing?.our_runs ?? null)
        : values.ourRuns === null
          ? null
          : Math.max(0, values.ourRuns),
    their_runs:
      values.theirRuns === undefined
        ? (existing?.their_runs ?? 0)
        : Math.max(0, values.theirRuns),
  };

  const { error } = await db
    .from('game_innings')
    .upsert(row, { onConflict: 'game_id,inning' });

  if (error) return { error: `Could not save: ${error.message}` };

  revalidateGame(gameId);
  return { success: 'Score updated.' };
}

/**
 * Moves a runner who is already on base.
 *
 * The scorekeeper taps the base a runner is standing on and then the base they
 * actually reached, which is how you fix the cases the automatic advancement
 * cannot know: a runner going first-to-third on a single, scoring from first on
 * a double, or being thrown out trying.
 *
 * The movement is recorded against the most recent plate appearance, so runs,
 * RBI and the base state all recompute from the play log rather than being
 * patched on top of it. A runner can only exist because someone batted, so
 * there is always a plate appearance to attach to.
 */

/** Replays a game the same way everywhere, corrections included. */
function currentState(game: ScorebookData) {
  return replayGame({
    plateAppearances: game.plateAppearances,
    inningRuns: game.inningRuns,
    lineupSize: game.lineup.length,
    lineupPlayerIds: game.lineup.map((l) => l.playerId),
    stateOverride: game.stateOverride,
    homeAway: game.homeAway,
    scheduledInnings: game.scheduledInnings,
  });
}

/**
 * Corrects the inning and the outs.
 *
 * Passing null clears the correction and puts both back to whatever the plays
 * say. The correction is anchored to the last recorded appearance, so plays
 * recorded from here on carry on from the corrected state.
 */
export async function setGameState(
  gameId: string,
  values: { inning?: number | null; outs?: number | null } | null,
): Promise<ActionState> {
  const denied = await assertScorer();
  if (denied) return { error: denied };

  const db = await createClient();

  const game = await getScorebook(gameId);
  if (!game) return { error: 'Game not found.' };

  if (values === null) {
    const { error } = await db
      .from('games')
      .update({
        state_override_after_seq: null,
        state_override_inning: null,
        state_override_outs: null,
      })
      .eq('id', gameId);

    if (error) return { error: `Could not clear: ${error.message}` };

    await syncLiveCursor(gameId);
    revalidateGame(gameId);
    return { success: 'Back to the plays.' };
  }

  const before = game.stateOverride;
  const prior = currentState(game);

  const inning = values.inning === undefined ? (before?.inning ?? null) : values.inning;

  // Moving to a different inning starts it the way an inning starts: nobody
  // out. Only an explicit out count survives that.
  const outs =
    values.outs !== undefined
      ? values.outs
      : inning !== null && inning !== prior.inning
        ? 0
        : (before?.outs ?? null);

  if (inning !== null && inning < 1) return { error: 'Inning must be 1 or greater.' };
  if (inning !== null && inning > game.scheduledInnings + 20) {
    return { error: 'That is well past the end of the game.' };
  }
  if (outs !== null && (outs < 0 || outs > 2)) {
    // Three outs ends the half, so the inning stepper retires the side.
    return { error: 'Outs run 0 to 2 — move the inning on to retire the side.' };
  }

  if (inning === null && outs === null) return setGameState(gameId, null);

  const lastSequence =
    game.plateAppearances[game.plateAppearances.length - 1]?.sequence ?? 0;

  const { error } = await db
    .from('games')
    .update({
      state_override_after_seq: lastSequence,
      state_override_inning: inning,
      state_override_outs: outs,
    })
    .eq('id', gameId);

  if (error) return { error: `Could not save: ${error.message}` };

  const after = currentState({ ...game, stateOverride: { afterSequence: lastSequence, inning, outs } });

  await db.from('game_events').insert({
    game_id: gameId,
    event_type: 'correction',
    inning: after.inning,
    half: after.half,
    description: `Set to ${formatInning(after.half, after.inning)}, ${formatOuts(after.outs)}`,
  });

  await syncLiveCursor(gameId);
  revalidateGame(gameId);
  return { success: 'Updated.' };
}

/**
 * Writes the replayed inning and outs onto the game row.
 *
 * Nothing derives statistics from these: they are the cursor the public live
 * banner reads, which cannot replay a play log of its own.
 */
async function syncLiveCursor(gameId: string) {
  const game = await getScorebook(gameId);
  if (!game || game.status !== 'live') return;

  const state = currentState(game);
  const db = await createClient();

  await db
    .from('games')
    .update({
      current_inning: state.inning,
      current_half: state.half,
      current_outs: Math.min(state.outs, 3),
    })
    .eq('id', gameId);
}

export async function moveRunner(
  gameId: string,
  fromBase: 1 | 2 | 3,
  destination: 1 | 2 | 3 | 4 | 'out',
): Promise<ActionState> {
  const denied = await assertScorer();
  if (denied) return { error: denied };

  const db = await createClient();

  const game = await getScorebook(gameId);
  if (!game) return { error: 'Game not found.' };

  const state = currentState(game);

  const runnerId = state.bases[fromBase - 1];
  if (!runnerId) return { error: `Nobody is on ${ordinal(fromBase)}.` };

  if (destination !== 'out' && destination <= fromBase) {
    return { error: 'Runners can only be moved forward.' };
  }

  const last = game.plateAppearances[game.plateAppearances.length - 1];
  if (!last) return { error: 'No play to attach this to yet.' };

  // Only a play that actually drives runs in earns an RBI.
  const { data: resultType } = await db
    .from('pa_result_types')
    .select('is_hit, is_walk, is_hbp, is_sac_fly')
    .eq('code', last.resultCode)
    .maybeSingle();

  const drivesInRuns = Boolean(
    resultType &&
      (resultType.is_hit || resultType.is_walk || resultType.is_hbp || resultType.is_sac_fly),
  );

  const isOut = destination === 'out';
  const endBase = isOut ? null : destination;

  // If this runner already moved on this play, correct that movement rather
  // than adding a second one for the same runner.
  const { data: existing } = await db
    .from('base_runner_movements')
    .select('id')
    .eq('plate_appearance_id', last.id)
    .eq('runner_id', runnerId)
    .eq('end_base', fromBase)
    .eq('is_out', false)
    .maybeSingle();

  const movement = {
    plate_appearance_id: last.id,
    runner_id: runnerId,
    start_base: existing ? undefined : fromBase,
    end_base: endBase,
    is_out: isOut,
    rbi_credited: endBase === 4 && drivesInRuns,
  };

  const { error } = existing
    ? await db
        .from('base_runner_movements')
        .update({
          end_base: movement.end_base,
          is_out: movement.is_out,
          rbi_credited: movement.rbi_credited,
        })
        .eq('id', existing.id)
    : await db.from('base_runner_movements').insert({
        plate_appearance_id: last.id,
        runner_id: runnerId,
        start_base: fromBase,
        end_base: endBase,
        is_out: isOut,
        rbi_credited: movement.rbi_credited,
      });

  if (error) return { error: `Could not move the runner: ${error.message}` };

  // Outs recorded on the play have to stay in step with the movements.
  const { data: movements } = await db
    .from('base_runner_movements')
    .select('is_out')
    .eq('plate_appearance_id', last.id);

  await db
    .from('plate_appearances')
    .update({ outs_on_play: (movements ?? []).filter((m) => m.is_out).length })
    .eq('id', last.id);

  await db.from('game_events').insert({
    game_id: gameId,
    event_type: 'correction',
    inning: last.inning,
    half: last.half,
    plate_appearance_id: last.id,
    description: isOut
      ? `Runner out at ${ordinal(fromBase)}`
      : `Runner ${ordinal(fromBase)} to ${destination === 4 ? 'home' : ordinal(destination)}`,
  });

  revalidateGame(gameId);
  return {
    success: isOut
      ? 'Runner marked out.'
      : `Runner moved to ${destination === 4 ? 'home' : ordinal(destination)}.`,
  };
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
