'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { TZDate } from '@date-fns/tz';
import { createClient } from '@/lib/supabase/server';
import { getSessionUser } from '@/lib/auth/session';
import { TEAM_TIME_ZONE } from '@/lib/time';
import type { ActionState } from './roster';

export type { ActionState };

/**
 * Schedule and game administration.
 *
 * Times are entered as local date + time (what a phone's datetime input gives)
 * and converted to an absolute instant in the team's zone before storage, so
 * the schedule is correct regardless of where it is later read.
 */

const gameSchema = z.object({
  id: z.string().uuid().nullish(),
  seasonId: z.string().uuid(),
  opponentId: z.string().uuid().nullish(),
  newOpponent: z.string().trim().nullish(),
  venueId: z.string().uuid().nullish(),
  newVenue: z.string().trim().nullish(),
  date: z.string().min(1, 'A date is required.'),
  time: z.string().min(1, 'A start time is required.'),
  homeAway: z.enum(['home', 'away']),
  gameNumber: z.coerce.number().int().min(1).max(4),
  scheduledInnings: z.coerce.number().int().min(1).max(15),
  status: z.enum(['scheduled', 'pregame', 'live', 'final', 'cancelled', 'postponed']),
  ourRuns: z.union([z.coerce.number().int().min(0), z.literal('')]).nullish(),
  theirRuns: z.union([z.coerce.number().int().min(0), z.literal('')]).nullish(),
  notes: z.string().nullish(),
});

function slugify(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

async function assertAdmin(): Promise<string | null> {
  const user = await getSessionUser();
  if (!user) return 'You are not signed in.';
  if (user.role !== 'admin') return 'Only admins can change the schedule.';
  return null;
}

/** `2026-09-16` + `17:00` in team time -> an absolute instant. */
function toInstant(date: string, time: string): string {
  const [y, m, d] = date.split('-').map(Number);
  const [hh, mm] = time.split(':').map(Number);
  return new TZDate(y, m - 1, d, hh, mm, 0, TEAM_TIME_ZONE).toISOString();
}

const nullableNumber = (v: unknown) =>
  v === '' || v === null || v === undefined ? null : Number(v);

export async function saveGame(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const denied = await assertAdmin();
  if (denied) return { error: denied };

  const parsed = gameSchema.safeParse({
    id: formData.get('id') || null,
    seasonId: formData.get('seasonId'),
    opponentId: formData.get('opponentId') || null,
    newOpponent: formData.get('newOpponent') || null,
    venueId: formData.get('venueId') || null,
    newVenue: formData.get('newVenue') || null,
    date: formData.get('date'),
    time: formData.get('time'),
    homeAway: formData.get('homeAway') ?? 'home',
    gameNumber: formData.get('gameNumber') ?? 1,
    scheduledInnings: formData.get('scheduledInnings') ?? 7,
    status: formData.get('status') ?? 'scheduled',
    ourRuns: formData.get('ourRuns') ?? '',
    theirRuns: formData.get('theirRuns') ?? '',
    notes: formData.get('notes') ?? '',
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Check the form and try again.' };
  }

  const v = parsed.data;
  const db = await createClient();

  // Opponents and venues can be created inline, so adding a fixture against a
  // new team does not require a detour to another screen.
  let opponentId = v.opponentId ?? null;
  if (!opponentId && v.newOpponent) {
    const { data, error } = await db
      .from('opponents')
      .upsert({ name: v.newOpponent, slug: slugify(v.newOpponent) }, { onConflict: 'slug' })
      .select('id')
      .single();
    if (error) return { error: `Could not create the opponent: ${error.message}` };
    opponentId = data.id;
  }

  let venueId = v.venueId ?? null;
  if (!venueId && v.newVenue) {
    const match = v.newVenue.match(/^(.*?)\s+-\s+(.*)$/);
    const name = match ? match[1].trim() : v.newVenue;
    const field = match ? match[2].trim() : null;
    const { data, error } = await db
      .from('venues')
      .upsert({ name, field, slug: slugify(v.newVenue) }, { onConflict: 'slug' })
      .select('id')
      .single();
    if (error) return { error: `Could not create the venue: ${error.message}` };
    venueId = data.id;
  }

  const startsAt = toInstant(v.date, v.time);

  const row = {
    season_id: v.seasonId,
    opponent_id: opponentId,
    venue_id: venueId,
    starts_at: startsAt,
    status: v.status,
    home_away: v.homeAway,
    game_number: v.gameNumber,
    scheduled_innings: v.scheduledInnings,
    // Groups a doubleheader so both games read as one evening.
    series_key: opponentId ? `${v.date}-${opponentId}` : null,
    our_runs_recorded: nullableNumber(v.ourRuns),
    their_runs_recorded: nullableNumber(v.theirRuns),
    notes: v.notes?.trim() || null,
    finalized_at: v.status === 'final' ? new Date().toISOString() : null,
  };

  let gameId = v.id ?? undefined;

  if (gameId) {
    const { error } = await db.from('games').update(row).eq('id', gameId);
    if (error) return { error: `Could not save: ${error.message}` };
  } else {
    const { data, error } = await db.from('games').insert(row).select('id').single();
    if (error) return { error: `Could not create: ${error.message}` };
    gameId = data.id;
  }

  revalidatePath('/admin/games');
  revalidatePath('/schedule');
  revalidatePath('/');
  revalidatePath(`/schedule/${gameId}`);

  return { success: 'Game saved.' };
}

/** Creates a second game of a doubleheader, 75 minutes after the first. */
export async function createSecondGame(gameId: string): Promise<ActionState> {
  const denied = await assertAdmin();
  if (denied) return { error: denied };

  const db = await createClient();
  const { data: first, error } = await db
    .from('games')
    .select('season_id, opponent_id, venue_id, starts_at, home_away, scheduled_innings, series_key')
    .eq('id', gameId)
    .single();

  if (error || !first) return { error: 'Could not read the first game.' };

  const secondStart = new Date(new Date(first.starts_at).getTime() + 75 * 60_000).toISOString();

  const { error: insertError } = await db.from('games').insert({
    season_id: first.season_id,
    opponent_id: first.opponent_id,
    venue_id: first.venue_id,
    starts_at: secondStart,
    home_away: first.home_away,
    scheduled_innings: first.scheduled_innings,
    series_key: first.series_key,
    game_number: 2,
    status: 'scheduled',
  });

  if (insertError) return { error: `Could not create game 2: ${insertError.message}` };

  revalidatePath('/admin/games');
  revalidatePath('/schedule');
  return { success: 'Game 2 created.' };
}

/** Sets or clears the Player of the Game. */
export async function setPlayerOfTheGame(
  gameId: string,
  playerId: string | null,
): Promise<ActionState> {
  const denied = await assertAdmin();
  if (denied) return { error: denied };

  const db = await createClient();

  const { data: game } = await db
    .from('games')
    .select('season_id, starts_at')
    .eq('id', gameId)
    .single();

  await db.from('player_awards').delete().eq('game_id', gameId).eq('award_code', 'potg');

  if (playerId && game) {
    const { error } = await db.from('player_awards').insert({
      player_id: playerId,
      award_code: 'potg',
      game_id: gameId,
      season_id: game.season_id,
      awarded_on: game.starts_at.slice(0, 10),
    });
    if (error) return { error: `Could not set the award: ${error.message}` };
  }

  revalidatePath(`/admin/games/${gameId}`);
  revalidatePath(`/schedule/${gameId}`);
  revalidatePath('/');
  return { success: playerId ? 'Player of the Game set.' : 'Award cleared.' };
}

export async function deleteGame(gameId: string): Promise<void> {
  const denied = await assertAdmin();
  if (denied) return;

  const db = await createClient();
  await db.from('games').delete().eq('id', gameId);

  revalidatePath('/admin/games');
  revalidatePath('/schedule');
  redirect('/admin/games');
}
