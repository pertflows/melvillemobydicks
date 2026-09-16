import { createClient } from '../supabase/server';
import { createStaticClient } from '../supabase/static';
import { mediaUrl, playerPhotoUrl, storageUrl } from '../storage';

export interface LogPost {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  body: string;
  paragraphs: string[];
  authorName: string | null;
  authorSlug: string | null;
  authorPhotoUrl: string | null;
  publishedAt: string | null;
  gameId: string | null;
  gameLabel: string | null;
  gameStartsAt: string | null;
}

const POST_SELECT =
  'id, slug, title, excerpt, body, author_name, published_at, game_id, players(slug, photo_path), games(starts_at, opponents(name))';

type PostRow = {
  id: string; slug: string; title: string; excerpt: string | null; body: string;
  author_name: string | null; published_at: string | null; game_id: string | null;
  players: { slug: string; photo_path: string | null } | null;
  games: { starts_at: string; opponents: { name: string } | null } | null;
};

function toPost(row: PostRow): LogPost {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    excerpt: row.excerpt,
    body: row.body,
    paragraphs: row.body.split('\n\n').filter(Boolean),
    authorName: row.author_name,
    authorSlug: row.players?.slug ?? null,
    authorPhotoUrl: playerPhotoUrl(row.players?.photo_path),
    publishedAt: row.published_at,
    gameId: row.game_id,
    gameLabel: row.games?.opponents?.name ? `vs ${row.games.opponents.name}` : null,
    gameStartsAt: row.games?.starts_at ?? null,
  };
}

export async function getPosts(limit?: number): Promise<LogPost[]> {
  const db = await createClient();
  let query = db
    .from('captains_log_posts')
    .select(POST_SELECT)
    .eq('is_published', true)
    .order('published_at', { ascending: false });

  if (limit) query = query.limit(limit);

  const { data, error } = await query;
  if (error) throw new Error(`getPosts: ${error.message}`);
  return (data ?? []).map((r) => toPost(r as PostRow));
}

export async function getPostBySlug(slug: string): Promise<LogPost | null> {
  const db = await createClient();
  const { data, error } = await db
    .from('captains_log_posts')
    .select(POST_SELECT)
    .eq('slug', slug)
    .eq('is_published', true)
    .maybeSingle();

  if (error) throw new Error(`getPostBySlug: ${error.message}`);
  return data ? toPost(data as PostRow) : null;
}

/** Build-time only: runs without a request, so it uses the cookieless client. */
export async function getPostSlugs(): Promise<string[]> {
  const db = createStaticClient();
  const { data } = await db.from('captains_log_posts').select('slug').eq('is_published', true);
  return (data ?? []).map((p) => p.slug);
}

export interface GalleryItem {
  id: string;
  url: string | null;
  caption: string | null;
  placeholder: string | null;
  width: number | null;
  height: number | null;
  gameId: string | null;
  gameLabel: string | null;
  gameStartsAt: string | null;
}

export async function getGallery(): Promise<GalleryItem[]> {
  const db = await createClient();
  const { data, error } = await db
    .from('media')
    .select('id, storage_path, caption, placeholder, width, height, game_id, games(starts_at, opponents(name))')
    .eq('kind', 'photo')
    .order('sort_order');

  if (error) throw new Error(`getGallery: ${error.message}`);

  return (data ?? []).map((m) => ({
    id: m.id,
    url: mediaUrl(m.storage_path),
    caption: m.caption,
    placeholder: m.placeholder,
    width: m.width,
    height: m.height,
    gameId: m.game_id,
    gameLabel: m.games?.opponents?.name ? `vs ${m.games.opponents.name}` : null,
    gameStartsAt: m.games?.starts_at ?? null,
  }));
}

export interface Sponsor {
  id: string;
  name: string;
  slug: string;
  websiteUrl: string | null;
  logoUrl: string | null;
  blurb: string | null;
}

export async function getSponsors(): Promise<Sponsor[]> {
  const db = await createClient();
  const { data, error } = await db
    .from('sponsors')
    .select('id, name, slug, website_url, logo_path, blurb')
    .eq('is_active', true)
    .order('sort_order');

  if (error) throw new Error(`getSponsors: ${error.message}`);

  return (data ?? []).map((s) => ({
    id: s.id,
    name: s.name,
    slug: s.slug,
    websiteUrl: s.website_url,
    logoUrl: storageUrl('branding', s.logo_path),
    blurb: s.blurb,
  }));
}

export interface AwardWinner {
  id: string;
  playerSlug: string;
  displayName: string;
  jerseyNumber: number | null;
  positionLabel: string | null;
  photoUrl: string | null;
  photoPlaceholder: string | null;
  awardedOn: string | null;
  gameId: string | null;
  opponentName: string | null;
  homeRuns: number;
  rbi: number;
  battingAverageDisplay: number | null;
}

/** Player of the Game winners, most recent first. */
export async function getRecentAwards(seasonId: string, limit = 5): Promise<AwardWinner[]> {
  const db = await createClient();

  const [{ data: awards, error }, { data: stats }, { data: memberships }] = await Promise.all([
    db
      .from('player_awards')
      .select('id, player_id, awarded_on, game_id, players(slug, display_name, photo_path, photo_placeholder, legacy_position_label), games(opponents(name))')
      .eq('award_code', 'potg')
      .eq('season_id', seasonId)
      .order('awarded_on', { ascending: false })
      .limit(limit),
    db.from('player_season_stats').select('player_id, hr, rbi, batting_average_display').eq('season_id', seasonId),
    db.from('player_seasons').select('player_id, jersey_number').eq('season_id', seasonId),
  ]);

  if (error) throw new Error(`getRecentAwards: ${error.message}`);

  const statByPlayer = new Map((stats ?? []).map((s) => [s.player_id, s]));
  const jerseyByPlayer = new Map((memberships ?? []).map((m) => [m.player_id, m.jersey_number]));

  return (awards ?? [])
    .filter((a) => a.players)
    .map((a) => {
      const stat = statByPlayer.get(a.player_id);
      return {
        id: a.id,
        playerSlug: a.players!.slug,
        displayName: a.players!.display_name,
        jerseyNumber: jerseyByPlayer.get(a.player_id) ?? null,
        positionLabel: a.players!.legacy_position_label,
        photoUrl: playerPhotoUrl(a.players!.photo_path),
        photoPlaceholder: a.players!.photo_placeholder,
        awardedOn: a.awarded_on,
        gameId: a.game_id,
        opponentName: a.games?.opponents?.name ?? null,
        homeRuns: stat?.hr ?? 0,
        rbi: stat?.rbi ?? 0,
        battingAverageDisplay:
          stat?.batting_average_display === null || stat?.batting_average_display === undefined
            ? null
            : Number(stat.batting_average_display),
      };
    });
}
