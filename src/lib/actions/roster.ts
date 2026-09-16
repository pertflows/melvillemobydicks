'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { getSessionUser } from '@/lib/auth/session';
import { processImageBuffer } from '@/lib/images/process';

/**
 * Roster mutations.
 *
 * Every action re-checks the caller's role. That check is belt-and-braces: row
 * level security already rejects these writes for anyone who is not an admin,
 * so a forged request fails at the database even if it reaches this code.
 *
 * Players are never deleted. Leaving the team is a status change, which keeps
 * their history, stats and awards intact.
 */

export interface ActionState {
  error?: string;
  success?: string;
}

const MAX_PHOTO_BYTES = 15 * 1024 * 1024;

const playerSchema = z.object({
  id: z.string().uuid().optional(),
  firstName: z.string().trim().min(1, 'First name is required.'),
  lastName: z.string().trim().min(1, 'Last name is required.'),
  displayName: z.string().trim().optional(),
  jerseyNumber: z
    .union([z.coerce.number().int().min(0).max(99), z.literal('')])
    .optional()
    .transform((v) => (v === '' || v === undefined ? null : Number(v))),
  primaryPosition: z.string().trim().optional(),
  secondaryPositions: z.array(z.string()).optional(),
  bio: z.string().optional(),
  status: z.enum(['active', 'inactive', 'alumni']),
  rosterOrder: z
    .union([z.coerce.number().int(), z.literal('')])
    .optional()
    .transform((v) => (v === '' || v === undefined ? null : Number(v))),
  seasonId: z.string().uuid(),
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
  if (user.role !== 'admin') return 'Only admins can change the roster.';
  return null;
}

function parseForm(formData: FormData) {
  return playerSchema.safeParse({
    id: formData.get('id') || undefined,
    firstName: formData.get('firstName'),
    lastName: formData.get('lastName'),
    displayName: formData.get('displayName') || undefined,
    jerseyNumber: formData.get('jerseyNumber') ?? '',
    primaryPosition: formData.get('primaryPosition') || undefined,
    secondaryPositions: formData.getAll('secondaryPositions').map(String).filter(Boolean),
    bio: formData.get('bio') ?? '',
    status: formData.get('status') ?? 'active',
    rosterOrder: formData.get('rosterOrder') ?? '',
    seasonId: formData.get('seasonId'),
  });
}

export async function savePlayer(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const denied = await assertAdmin();
  if (denied) return { error: denied };

  const parsed = parseForm(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Check the form and try again.' };
  }

  const input = parsed.data;
  const db = await createClient();
  const displayName = input.displayName?.trim() || `${input.firstName} ${input.lastName}`;

  const playerRow = {
    first_name: input.firstName,
    last_name: input.lastName,
    display_name: displayName,
    slug: slugify(displayName),
    bio: input.bio?.trim() || null,
    status: input.status,
    primary_position: input.primaryPosition || null,
    secondary_positions: input.secondaryPositions ?? [],
  };

  let playerId = input.id;

  if (playerId) {
    const { error } = await db.from('players').update(playerRow).eq('id', playerId);
    if (error) return { error: `Could not save: ${error.message}` };
  } else {
    const { data, error } = await db.from('players').insert(playerRow).select('id').single();
    if (error) return { error: `Could not create: ${error.message}` };
    playerId = data.id;
  }

  // Season membership carries the jersey number and position.
  const { error: seasonError } = await db.from('player_seasons').upsert(
    {
      player_id: playerId!,
      season_id: input.seasonId,
      jersey_number: input.jerseyNumber,
      primary_position: input.primaryPosition || null,
      secondary_positions: input.secondaryPositions ?? [],
      status: input.status,
      roster_order: input.rosterOrder,
    },
    { onConflict: 'player_id,season_id' },
  );

  if (seasonError) {
    return {
      error: /player_seasons_jersey_unique/.test(seasonError.message)
        ? `Number ${input.jerseyNumber} is already taken this season.`
        : `Could not save the season roster entry: ${seasonError.message}`,
    };
  }

  // Photo is optional on every save.
  const photo = formData.get('photo');
  if (photo instanceof File && photo.size > 0) {
    const photoError = await uploadPlayerPhoto(playerId!, displayName, photo);
    if (photoError) return { error: photoError };
  }

  revalidatePath('/admin/roster');
  revalidatePath('/roster');
  revalidatePath(`/roster/${playerRow.slug}`);

  return { success: `Saved ${displayName}.` };
}

/**
 * Converts an uploaded photo the same way the importer does, keeps the original
 * privately, and serves WebP. Phone uploads are very often HEIC.
 */
async function uploadPlayerPhoto(
  playerId: string,
  displayName: string,
  file: File,
): Promise<string | null> {
  if (file.size > MAX_PHOTO_BYTES) {
    return `That photo is ${(file.size / 1024 / 1024).toFixed(1)}MB; the limit is 15MB.`;
  }

  const db = await createClient();
  const buffer = Buffer.from(await file.arrayBuffer());

  let processed;
  try {
    processed = await processImageBuffer(buffer, { maxEdge: 1600, filename: file.name });
  } catch (err) {
    return `That image could not be read (${(err as Error).message}).`;
  }

  const stamp = Date.now();
  const base = `${slugify(displayName)}-${stamp}`;

  const { error: uploadError } = await db.storage
    .from('players')
    .upload(`${base}.webp`, processed.optimized, {
      contentType: 'image/webp',
      upsert: true,
    });
  if (uploadError) return `Photo upload failed: ${uploadError.message}`;

  const originalExt = file.name.split('.').pop()?.toLowerCase() ?? 'bin';
  await db.storage
    .from('originals')
    .upload(`players/${base}.${originalExt}`, processed.original, {
      contentType: processed.originalContentType,
      upsert: true,
    });

  const { error } = await db
    .from('players')
    .update({
      photo_path: `${base}.webp`,
      photo_original_path: `players/${base}.${originalExt}`,
      photo_width: processed.width,
      photo_height: processed.height,
      photo_placeholder: processed.placeholder,
    })
    .eq('id', playerId);

  return error ? `Could not record the photo: ${error.message}` : null;
}

/** Status change instead of deletion, so history survives. */
export async function setPlayerStatus(
  playerId: string,
  seasonId: string,
  status: 'active' | 'inactive' | 'alumni',
): Promise<ActionState> {
  const denied = await assertAdmin();
  if (denied) return { error: denied };

  const db = await createClient();

  const [{ error: playerError }, { error: seasonError }] = await Promise.all([
    db.from('players').update({ status }).eq('id', playerId),
    db.from('player_seasons').update({ status }).eq('player_id', playerId).eq('season_id', seasonId),
  ]);

  if (playerError || seasonError) {
    return { error: (playerError ?? seasonError)!.message };
  }

  revalidatePath('/admin/roster');
  revalidatePath('/roster');
  return { success: 'Status updated.' };
}

const baselineSchema = z.object({
  playerId: z.string().uuid(),
  seasonId: z.string().uuid(),
  games: z.coerce.number().int().min(0).nullable(),
  hits: z.coerce.number().int().min(0).nullable(),
  homeRuns: z.coerce.number().int().min(0).nullable(),
  rbi: z.coerce.number().int().min(0).nullable(),
  walks: z.coerce.number().int().min(0).nullable(),
  atBats: z.coerce.number().int().min(0).nullable(),
  battingAverageOverride: z.coerce.number().min(0).max(9.999).nullable(),
  notes: z.string().optional(),
});

const optionalNumber = (v: FormDataEntryValue | null) =>
  v === null || String(v).trim() === '' ? null : v;

/**
 * Edits an imported legacy baseline.
 *
 * Filling in at-bats here is how a historical season graduates from "average
 * inherited from the old site" to a genuinely computed rate: player_season_stats
 * switches basis automatically once at_bats is known.
 */
export async function saveLegacyBaseline(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const denied = await assertAdmin();
  if (denied) return { error: denied };

  const parsed = baselineSchema.safeParse({
    playerId: formData.get('playerId'),
    seasonId: formData.get('seasonId'),
    games: optionalNumber(formData.get('games')),
    hits: optionalNumber(formData.get('hits')),
    homeRuns: optionalNumber(formData.get('homeRuns')),
    rbi: optionalNumber(formData.get('rbi')),
    walks: optionalNumber(formData.get('walks')),
    atBats: optionalNumber(formData.get('atBats')),
    battingAverageOverride: optionalNumber(formData.get('battingAverageOverride')),
    notes: formData.get('notes') ?? '',
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Check the values and try again.' };
  }

  const v = parsed.data;

  if (v.atBats !== null && v.hits !== null && v.hits > v.atBats) {
    return { error: 'Hits cannot exceed at-bats.' };
  }

  const db = await createClient();
  const { error } = await db.from('legacy_stat_baselines').upsert(
    {
      player_id: v.playerId,
      season_id: v.seasonId,
      games: v.games,
      hits: v.hits,
      home_runs: v.homeRuns,
      rbi: v.rbi,
      walks: v.walks,
      at_bats: v.atBats,
      batting_average_override: v.battingAverageOverride,
      notes: v.notes?.trim() || null,
    },
    { onConflict: 'player_id,season_id' },
  );

  if (error) return { error: `Could not save the baseline: ${error.message}` };

  revalidatePath('/admin/roster');
  revalidatePath('/stats');
  revalidatePath('/roster');

  return {
    success:
      v.atBats !== null
        ? 'Baseline saved. With at-bats known, rate stats are now computed for this season.'
        : 'Baseline saved.',
  };
}
