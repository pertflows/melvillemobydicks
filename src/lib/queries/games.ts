import { createClient } from '../supabase/server';
import { createStaticClient } from '../supabase/static';
import { mediaUrl, playerPhotoUrl } from '../storage';

export type GameStatus = 'scheduled' | 'pregame' | 'live' | 'final' | 'cancelled' | 'postponed';

export interface GameSummary {
  id: string;
  startsAt: string;
  status: GameStatus;
  homeAway: 'home' | 'away';
  gameNumber: number;
  seriesKey: string | null;
  opponentName: string | null;
  opponentSlug: string | null;
  venueName: string | null;
  ourRuns: number | null;
  theirRuns: number | null;
  result: 'W' | 'L' | 'T' | null;
  isMercy: boolean;
}

const GAME_SELECT =
  'id, starts_at, status, home_away, game_number, series_key, is_mercy, opponents(name, slug), venues(display_name)';

type GameRow = {
  id: string; starts_at: string; status: GameStatus; home_away: 'home' | 'away';
  game_number: number; series_key: string | null; is_mercy: boolean;
  opponents: { name: string; slug: string } | null;
  venues: { display_name: string | null } | null;
};

function toSummary(
  row: GameRow,
  score: { our_runs: number | null; their_runs: number | null } | undefined,
): GameSummary {
  const ourRuns = score?.our_runs ?? null;
  const theirRuns = score?.their_runs ?? null;

  return {
    id: row.id,
    startsAt: row.starts_at,
    status: row.status,
    homeAway: row.home_away,
    gameNumber: row.game_number,
    seriesKey: row.series_key,
    opponentName: row.opponents?.name ?? null,
    opponentSlug: row.opponents?.slug ?? null,
    venueName: row.venues?.display_name ?? null,
    ourRuns,
    theirRuns,
    result:
      row.status !== 'final' || ourRuns === null || theirRuns === null
        ? null
        : ourRuns > theirRuns ? 'W' : ourRuns < theirRuns ? 'L' : 'T',
    isMercy: row.is_mercy,
  };
}

/** Every game in a season, chronological. Scores resolved by the view. */
export async function getSchedule(seasonId: string): Promise<GameSummary[]> {
  const db = await createClient();

  const [{ data: games, error }, { data: scores }] = await Promise.all([
    db.from('games').select(GAME_SELECT).eq('season_id', seasonId).order('starts_at'),
    db.from('game_scoreboard').select('game_id, our_runs, their_runs').eq('season_id', seasonId),
  ]);

  if (error) throw new Error(`getSchedule: ${error.message}`);

  const scoreByGame = new Map((scores ?? []).map((s) => [s.game_id, s]));
  return (games ?? []).map((g) => toSummary(g as GameRow, scoreByGame.get(g.id)));
}

/** Completed games, most recent first. */
export async function getRecentResults(seasonId: string, limit = 5): Promise<GameSummary[]> {
  const all = await getSchedule(seasonId);
  return all
    .filter((g) => g.status === 'final')
    .sort((a, b) => (a.startsAt < b.startsAt ? 1 : -1))
    .slice(0, limit);
}

/** Games yet to be played, soonest first. */
export async function getUpcomingGames(seasonId: string, limit = 5): Promise<GameSummary[]> {
  const all = await getSchedule(seasonId);
  const now = Date.now();
  return all
    .filter((g) => g.status === 'scheduled' || g.status === 'pregame' || g.status === 'live')
    .filter((g) => g.status !== 'scheduled' || new Date(g.startsAt).getTime() >= now - 4 * 3600_000)
    .slice(0, limit);
}

/** A game currently being scored, if any. */
export async function getLiveGame(): Promise<GameSummary | null> {
  const db = await createClient();
  const { data } = await db
    .from('games')
    .select(GAME_SELECT)
    .in('status', ['live', 'pregame'])
    .order('starts_at')
    .limit(1)
    .maybeSingle();

  if (!data) return null;

  const { data: score } = await db
    .from('game_scoreboard')
    .select('our_runs, their_runs')
    .eq('game_id', data.id)
    .maybeSingle();

  return toSummary(data as GameRow, score ?? undefined);
}

export interface GameDetail extends GameSummary {
  recap: string | null;
  notes: string | null;
  scheduledInnings: number;
  currentInning: number | null;
  currentHalf: 'top' | 'bottom' | null;
  currentOuts: number | null;
  innings: { inning: number; ourRuns: number; theirRuns: number }[];
  potg: {
    playerSlug: string;
    displayName: string;
    jerseyNumber: number | null;
    positionLabel: string | null;
    photoUrl: string | null;
    photoPlaceholder: string | null;
    homeRuns: number;
    rbi: number;
    battingAverageDisplay: number | null;
  } | null;
  photos: { id: string; url: string | null; caption: string | null; placeholder: string | null; width: number | null; height: number | null }[];
  post: { slug: string; title: string; excerpt: string | null } | null;
}

export async function getGameById(id: string): Promise<GameDetail | null> {
  const db = await createClient();

  const { data: game, error } = await db
    .from('games')
    .select(`${GAME_SELECT}, season_id, recap, notes, scheduled_innings, current_inning, current_half, current_outs`)
    .eq('id', id)
    .maybeSingle();

  if (error) throw new Error(`getGameById: ${error.message}`);
  if (!game) return null;

  const [{ data: score }, { data: innings }, { data: award }, { data: photos }, { data: post }] =
    await Promise.all([
      db.from('game_scoreboard').select('our_runs, their_runs').eq('game_id', id).maybeSingle(),
      db.from('game_innings').select('inning, our_runs, their_runs').eq('game_id', id).order('inning'),
      db
        .from('player_awards')
        .select('player_id, players(slug, display_name, photo_path, photo_placeholder, legacy_position_label)')
        .eq('game_id', id)
        .eq('award_code', 'potg')
        .maybeSingle(),
      db
        .from('media')
        .select('id, storage_path, caption, placeholder, width, height')
        .eq('game_id', id)
        .order('sort_order'),
      db
        .from('captains_log_posts')
        .select('slug, title, excerpt')
        .eq('game_id', id)
        .eq('is_published', true)
        .maybeSingle(),
    ]);

  const summary = toSummary(game as GameRow, score ?? undefined);

  let potg: GameDetail['potg'] = null;
  if (award?.players) {
    const p = award.players;
    const [{ data: ps }, { data: stat }] = await Promise.all([
      db
        .from('player_seasons')
        .select('jersey_number')
        .eq('season_id', game.season_id)
        .eq('player_id', award.player_id)
        .maybeSingle(),
      db
        .from('player_season_stats')
        .select('hr, rbi, batting_average_display')
        .eq('season_id', game.season_id)
        .eq('player_id', award.player_id)
        .maybeSingle(),
    ]);

    potg = {
      playerSlug: p.slug,
      displayName: p.display_name,
      jerseyNumber: ps?.jersey_number ?? null,
      positionLabel: p.legacy_position_label,
      photoUrl: playerPhotoUrl(p.photo_path),
      photoPlaceholder: p.photo_placeholder,
      homeRuns: stat?.hr ?? 0,
      rbi: stat?.rbi ?? 0,
      battingAverageDisplay:
        stat?.batting_average_display === null || stat?.batting_average_display === undefined
          ? null
          : Number(stat.batting_average_display),
    };
  }

  return {
    ...summary,
    recap: game.recap,
    notes: game.notes,
    scheduledInnings: game.scheduled_innings,
    currentInning: game.current_inning,
    currentHalf: game.current_half,
    currentOuts: game.current_outs,
    innings: (innings ?? []).map((i) => ({
      inning: i.inning, ourRuns: i.our_runs, theirRuns: i.their_runs,
    })),
    potg,
    photos: (photos ?? []).map((m) => ({
      id: m.id,
      url: mediaUrl(m.storage_path),
      caption: m.caption,
      placeholder: m.placeholder,
      width: m.width,
      height: m.height,
    })),
    post: post ?? null,
  };
}

/** Build-time only: runs without a request, so it uses the cookieless client. */
export async function getGameIds(): Promise<string[]> {
  const db = createStaticClient();
  const { data } = await db.from('games').select('id');
  return (data ?? []).map((g) => g.id);
}
