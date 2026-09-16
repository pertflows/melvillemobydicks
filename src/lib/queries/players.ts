import { createClient } from '../supabase/server';
import { playerPhotoUrl } from '../storage';

/**
 * Player reads.
 *
 * Statistics always come from the `player_season_stats` view, which combines
 * event-derived numbers with imported legacy baselines and reports which basis
 * each rate stat used. Components receive `avgBasis` so they can be honest
 * about inherited numbers instead of presenting everything as computed.
 */

export interface SeasonStatLine {
  games: number;
  plateAppearances: number | null;
  atBats: number | null;
  runs: number;
  hits: number;
  singles: number;
  doubles: number;
  triples: number;
  homeRuns: number;
  totalBases: number | null;
  rbi: number;
  walks: number;
  strikeouts: number;
  /** The honest combined average; null when at-bats are unknown. */
  battingAverage: number | null;
  /** Best available number for display, which may be an inherited value. */
  battingAverageDisplay: number | null;
  avgBasis: 'computed' | 'legacy_override' | 'derived_partial' | null;
  obp: number | null;
  slg: number | null;
  ops: number | null;
}

export interface RosterPlayer {
  id: string;
  slug: string;
  displayName: string;
  firstName: string;
  lastName: string;
  jerseyNumber: number | null;
  position: string | null;
  positionLabel: string | null;
  status: 'active' | 'inactive' | 'alumni';
  photoUrl: string | null;
  photoWidth: number | null;
  photoHeight: number | null;
  photoPlaceholder: string | null;
  rosterOrder: number | null;
  stats: SeasonStatLine | null;
  awardCount: number;
}

const STAT_SELECT =
  'season_id, player_id, g, pa, ab, r, h, singles, doubles, triples, hr, tb, rbi, bb, k, batting_average, batting_average_display, batting_average_basis, obp, slg, ops';

type StatRow = {
  g: number | null; pa: number | null; ab: number | null; r: number | null;
  h: number | null; singles: number | null; doubles: number | null; triples: number | null;
  hr: number | null; tb: number | null; rbi: number | null; bb: number | null; k: number | null;
  batting_average: number | null; batting_average_display: number | null;
  batting_average_basis: string | null;
  obp: number | null; slg: number | null; ops: number | null;
};

function toStatLine(row: StatRow | undefined): SeasonStatLine | null {
  if (!row) return null;
  return {
    games: row.g ?? 0,
    plateAppearances: row.pa,
    atBats: row.ab,
    runs: row.r ?? 0,
    hits: row.h ?? 0,
    singles: row.singles ?? 0,
    doubles: row.doubles ?? 0,
    triples: row.triples ?? 0,
    homeRuns: row.hr ?? 0,
    totalBases: row.tb,
    rbi: row.rbi ?? 0,
    walks: row.bb ?? 0,
    strikeouts: row.k ?? 0,
    battingAverage: row.batting_average === null ? null : Number(row.batting_average),
    battingAverageDisplay:
      row.batting_average_display === null ? null : Number(row.batting_average_display),
    avgBasis: (row.batting_average_basis as SeasonStatLine['avgBasis']) ?? null,
    obp: row.obp === null ? null : Number(row.obp),
    slg: row.slg === null ? null : Number(row.slg),
    ops: row.ops === null ? null : Number(row.ops),
  };
}

/** The season roster, in the order the team wants it displayed. */
export async function getRoster(seasonId: string): Promise<RosterPlayer[]> {
  const db = await createClient();

  const [{ data: memberships, error }, { data: stats }, { data: awards }] = await Promise.all([
    db
      .from('player_seasons')
      .select(
        'jersey_number, primary_position, status, roster_order, players(id, slug, display_name, first_name, last_name, photo_path, photo_width, photo_height, photo_placeholder, legacy_position_label), positions(label)',
      )
      .eq('season_id', seasonId),
    db.from('player_season_stats').select(STAT_SELECT).eq('season_id', seasonId),
    db.from('player_awards').select('player_id').eq('award_code', 'potg'),
  ]);

  if (error) throw new Error(`getRoster: ${error.message}`);

  const statsByPlayer = new Map((stats ?? []).map((s) => [s.player_id, s as StatRow]));
  const awardsByPlayer = new Map<string, number>();
  for (const a of awards ?? []) {
    awardsByPlayer.set(a.player_id, (awardsByPlayer.get(a.player_id) ?? 0) + 1);
  }

  return (memberships ?? [])
    .filter((m) => m.players)
    .map((m) => {
      const p = m.players!;
      return {
        id: p.id,
        slug: p.slug,
        displayName: p.display_name,
        firstName: p.first_name,
        lastName: p.last_name,
        jerseyNumber: m.jersey_number,
        position: m.primary_position,
        positionLabel: m.positions?.label ?? p.legacy_position_label,
        status: m.status,
        photoUrl: playerPhotoUrl(p.photo_path),
        photoWidth: p.photo_width,
        photoHeight: p.photo_height,
        photoPlaceholder: p.photo_placeholder,
        rosterOrder: m.roster_order,
        stats: toStatLine(statsByPlayer.get(p.id)),
        awardCount: awardsByPlayer.get(p.id) ?? 0,
      };
    })
    .sort((a, b) => {
      // Jersey number is the roster's natural order on a sports site.
      if (a.jerseyNumber === null) return 1;
      if (b.jerseyNumber === null) return -1;
      return a.jerseyNumber - b.jerseyNumber;
    });
}

export interface PlayerAward {
  id: string;
  awardedOn: string | null;
  gameId: string | null;
  opponentName: string | null;
  venueName: string | null;
  startsAt: string | null;
  ourRuns: number | null;
  theirRuns: number | null;
  result: string | null;
}

export interface PlayerProfile extends RosterPlayer {
  bio: string | null;
  bioParagraphs: string[];
  awards: PlayerAward[];
  careerHomeRuns: number;
  careerHits: number;
  careerGames: number;
}

export async function getPlayerBySlug(
  slug: string,
  seasonId: string,
): Promise<PlayerProfile | null> {
  const db = await createClient();

  const { data: player, error } = await db
    .from('players')
    .select(
      'id, slug, display_name, first_name, last_name, bio, status, photo_path, photo_width, photo_height, photo_placeholder, legacy_position_label',
    )
    .eq('slug', slug)
    .maybeSingle();

  if (error) throw new Error(`getPlayerBySlug: ${error.message}`);
  if (!player) return null;

  const [{ data: membership }, { data: stat }, { data: awardRows }, { data: career }] =
    await Promise.all([
      db
        .from('player_seasons')
        .select('jersey_number, primary_position, status, roster_order, positions(label)')
        .eq('player_id', player.id)
        .eq('season_id', seasonId)
        .maybeSingle(),
      db
        .from('player_season_stats')
        .select(STAT_SELECT)
        .eq('player_id', player.id)
        .eq('season_id', seasonId)
        .maybeSingle(),
      db
        .from('player_awards')
        .select('id, awarded_on, game_id, games(starts_at, our_runs_recorded, their_runs_recorded, opponents(name), venues(display_name))')
        .eq('player_id', player.id)
        .eq('award_code', 'potg')
        .order('awarded_on', { ascending: false }),
      db
        .from('player_career_stats')
        .select('g, h, hr')
        .eq('player_id', player.id)
        .maybeSingle(),
    ]);

  const awards: PlayerAward[] = (awardRows ?? []).map((a) => {
    const g = a.games;
    const ours = g?.our_runs_recorded ?? null;
    const theirs = g?.their_runs_recorded ?? null;
    return {
      id: a.id,
      awardedOn: a.awarded_on,
      gameId: a.game_id,
      opponentName: g?.opponents?.name ?? null,
      venueName: g?.venues?.display_name ?? null,
      startsAt: g?.starts_at ?? null,
      ourRuns: ours,
      theirRuns: theirs,
      result:
        ours === null || theirs === null ? null : ours > theirs ? 'W' : ours < theirs ? 'L' : 'T',
    };
  });

  return {
    id: player.id,
    slug: player.slug,
    displayName: player.display_name,
    firstName: player.first_name,
    lastName: player.last_name,
    jerseyNumber: membership?.jersey_number ?? null,
    position: membership?.primary_position ?? null,
    positionLabel: membership?.positions?.label ?? player.legacy_position_label,
    status: player.status,
    photoUrl: playerPhotoUrl(player.photo_path),
    photoWidth: player.photo_width,
    photoHeight: player.photo_height,
    photoPlaceholder: player.photo_placeholder,
    rosterOrder: membership?.roster_order ?? null,
    stats: toStatLine((stat as StatRow) ?? undefined),
    awardCount: awards.length,
    bio: player.bio,
    bioParagraphs: player.bio ? player.bio.split('\n\n').filter(Boolean) : [],
    awards,
    careerGames: career?.g ?? 0,
    careerHits: career?.h ?? 0,
    careerHomeRuns: career?.hr ?? 0,
  };
}

