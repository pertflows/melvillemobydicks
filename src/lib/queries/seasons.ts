import { createClient } from '../supabase/server';

export interface Season {
  id: string;
  year: number;
  name: string;
  slug: string;
  isCurrent: boolean;
}

function toSeason(row: {
  id: string; year: number; name: string; slug: string; is_current: boolean;
}): Season {
  return {
    id: row.id, year: row.year, name: row.name, slug: row.slug, isCurrent: row.is_current,
  };
}

/** Every season, newest first. */
export async function getSeasons(): Promise<Season[]> {
  const db = await createClient();
  const { data, error } = await db
    .from('seasons')
    .select('id, year, name, slug, is_current')
    .order('year', { ascending: false });

  if (error) throw new Error(`getSeasons: ${error.message}`);
  return data.map(toSeason);
}

/**
 * The season the site defaults to. Falls back to the most recent season so the
 * site never renders empty just because nobody flipped the `is_current` flag.
 */
export async function getCurrentSeason(): Promise<Season | null> {
  const seasons = await getSeasons();
  return seasons.find((s) => s.isCurrent) ?? seasons[0] ?? null;
}

export async function getSeasonBySlug(slug: string): Promise<Season | null> {
  const seasons = await getSeasons();
  return seasons.find((s) => s.slug === slug) ?? null;
}
