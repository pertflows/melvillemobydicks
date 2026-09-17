'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { getSessionUser } from '@/lib/auth/session';
import { CORRECTABLE, type CorrectableStat } from '@/lib/stats/corrections';
import type { ActionState } from './roster';

export type { ActionState };

/**
 * Hand corrections to a game's batting lines.
 *
 * The play log is still where statistics come from. This is for the case it
 * cannot cover on its own: the game was scored on a phone between innings and
 * the paper book, kept properly, disagrees. A corrected column wins; a column
 * left alone keeps deriving, so correcting the RBI does not freeze the hits.
 */

async function assertScorer(): Promise<string | null> {
  const user = await getSessionUser();
  if (!user) return 'You are not signed in.';
  if (user.role !== 'admin' && user.role !== 'scorekeeper') {
    return 'You do not have permission to correct statistics.';
  }
  return null;
}

function revalidateStats(gameId: string) {
  revalidatePath(`/admin/games/${gameId}/stats`);
  revalidatePath(`/schedule/${gameId}`);
  revalidatePath('/stats');
  revalidatePath('/roster', 'layout');
  revalidatePath('/');
}

export interface StatCorrectionInput {
  playerId: string;
  values: Partial<Record<CorrectableStat, number | null>>;
}

/**
 * Saves one player's corrected line.
 *
 * A line where every column has been cleared corrects nothing, so the row is
 * deleted rather than kept as a shell - which is also what makes "revert to the
 * plays" a delete rather than a special case.
 */
export async function saveStatCorrection(
  gameId: string,
  input: StatCorrectionInput,
): Promise<ActionState> {
  const denied = await assertScorer();
  if (denied) return { error: denied };

  const db = await createClient();

  const { data: existing } = await db
    .from('game_stat_overrides')
    .select('ab, h, doubles, triples, hr, r, rbi, bb, k, note')
    .eq('game_id', gameId)
    .eq('player_id', input.playerId)
    .maybeSingle();

  // A column the caller did not mention keeps whatever it had, so saving one
  // cell never silently clears the rest of the line.
  const merged = Object.fromEntries(
    CORRECTABLE.map((stat) => {
      const supplied = input.values[stat];
      const next = supplied === undefined ? (existing?.[stat] ?? null) : supplied;
      return [stat, next === null ? null : Math.max(0, Math.round(next))];
    }),
  ) as Record<CorrectableStat, number | null>;

  if (CORRECTABLE.every((stat) => merged[stat] === null)) {
    const { error } = await db
      .from('game_stat_overrides')
      .delete()
      .eq('game_id', gameId)
      .eq('player_id', input.playerId);

    if (error) return { error: `Could not clear: ${error.message}` };

    revalidateStats(gameId);
    return { success: 'Back to the plays.' };
  }

  // Catch what the database would reject anyway, but in words a scorer can act on.
  const { ab, h, doubles, triples, hr, k } = merged;
  if (h !== null && ab !== null && h > ab) {
    return { error: 'Hits cannot be more than at-bats.' };
  }
  if (k !== null && ab !== null && k > ab) {
    return { error: 'Strikeouts cannot be more than at-bats.' };
  }
  if (h !== null && (doubles ?? 0) + (triples ?? 0) + (hr ?? 0) > h) {
    return { error: 'Doubles, triples and home runs cannot add up to more than the hits.' };
  }

  const { error } = await db.from('game_stat_overrides').upsert(
    {
      game_id: gameId,
      player_id: input.playerId,
      ...merged,
      note: existing?.note ?? null,
    },
    { onConflict: 'game_id,player_id' },
  );

  if (error) return { error: `Could not save: ${error.message}` };

  revalidateStats(gameId);
  return { success: 'Saved.' };
}

/** Drops every correction on a game, putting the whole sheet back to the plays. */
export async function clearStatCorrections(gameId: string): Promise<ActionState> {
  const denied = await assertScorer();
  if (denied) return { error: denied };

  const db = await createClient();
  const { error } = await db.from('game_stat_overrides').delete().eq('game_id', gameId);

  if (error) return { error: `Could not clear: ${error.message}` };

  revalidateStats(gameId);
  return { success: 'Every line is back to the plays.' };
}
