import { createClient } from '../supabase/server';
import { playerPhotoUrl } from '../storage';

/** Reads that only the admin dashboard needs. */

export interface AdminActivity {
  id: number;
  action: string;
  entity: string;
  summary: string | null;
  createdAt: string;
  actorName: string | null;
}

export async function getRecentActivity(limit = 8): Promise<AdminActivity[]> {
  const db = await createClient();
  const { data } = await db
    .from('audit_logs')
    .select('id, action, entity, summary, created_at, actor_id')
    .order('created_at', { ascending: false })
    .limit(limit);

  const rows = data ?? [];

  // audit_logs.actor_id references auth.users, not profiles, so PostgREST
  // cannot embed the name - resolve it in a second query.
  const actorIds = [...new Set(rows.map((r) => r.actor_id).filter((id): id is string => !!id))];
  const namesById = new Map<string, string | null>();

  if (actorIds.length > 0) {
    const { data: profiles } = await db
      .from('profiles')
      .select('id, full_name')
      .in('id', actorIds);
    for (const p of profiles ?? []) namesById.set(p.id, p.full_name);
  }

  return rows.map((row) => ({
    id: row.id,
    action: row.action,
    entity: row.entity,
    summary: row.summary,
    createdAt: row.created_at,
    actorName: row.actor_id ? (namesById.get(row.actor_id) ?? null) : null,
  }));
}

export interface AdminCounts {
  activeRoster: number;
  scheduledGames: number;
  awaitingReview: number;
  liveGames: number;
}

/**
 * Dashboard counters.
 *
 * "Awaiting review" is a game whose start time has passed but which is still
 * marked scheduled or live - i.e. somebody needs to finish or finalise it.
 */
export async function getAdminCounts(seasonId: string): Promise<AdminCounts> {
  const db = await createClient();
  const nowIso = new Date().toISOString();

  const [roster, scheduled, awaiting, live] = await Promise.all([
    db
      .from('player_seasons')
      .select('*', { count: 'exact', head: true })
      .eq('season_id', seasonId)
      .eq('status', 'active'),
    db
      .from('games')
      .select('*', { count: 'exact', head: true })
      .eq('season_id', seasonId)
      .eq('status', 'scheduled')
      .gte('starts_at', nowIso),
    db
      .from('games')
      .select('*', { count: 'exact', head: true })
      .eq('season_id', seasonId)
      .in('status', ['scheduled', 'pregame', 'live'])
      .lt('starts_at', nowIso),
    db
      .from('games')
      .select('*', { count: 'exact', head: true })
      .in('status', ['live', 'pregame']),
  ]);

  return {
    activeRoster: roster.count ?? 0,
    scheduledGames: scheduled.count ?? 0,
    awaitingReview: awaiting.count ?? 0,
    liveGames: live.count ?? 0,
  };
}

export interface AdminPlayerRow {
  id: string;
  slug: string;
  displayName: string;
  firstName: string;
  lastName: string;
  status: 'active' | 'inactive' | 'alumni';
  bio: string | null;
  photoUrl: string | null;
  jerseyNumber: number | null;
  position: string | null;
  rosterOrder: number | null;
  inSeason: boolean;
  legacyBaseline: {
    games: number | null;
    hits: number | null;
    homeRuns: number | null;
    rbi: number | null;
    walks: number | null;
    atBats: number | null;
    battingAverageOverride: number | null;
    notes: string | null;
  } | null;
}

/** Every player, with their membership in the given season if they have one. */
export async function getAdminRoster(seasonId: string): Promise<AdminPlayerRow[]> {
  const db = await createClient();

  const [{ data: players }, { data: memberships }, { data: baselines }] = await Promise.all([
    db
      .from('players')
      .select('id, slug, display_name, first_name, last_name, status, bio, photo_path')
      .order('last_name'),
    db
      .from('player_seasons')
      .select('player_id, jersey_number, primary_position, roster_order, status')
      .eq('season_id', seasonId),
    db
      .from('legacy_stat_baselines')
      .select('player_id, games, hits, home_runs, rbi, walks, at_bats, batting_average_override, notes')
      .eq('season_id', seasonId),
  ]);

  const memberByPlayer = new Map((memberships ?? []).map((m) => [m.player_id, m]));
  const baseByPlayer = new Map((baselines ?? []).map((b) => [b.player_id, b]));

  return (players ?? [])
    .map((p) => {
      const m = memberByPlayer.get(p.id);
      const b = baseByPlayer.get(p.id);

      return {
        id: p.id,
        slug: p.slug,
        displayName: p.display_name,
        firstName: p.first_name,
        lastName: p.last_name,
        status: m?.status ?? p.status,
        bio: p.bio,
        photoUrl: playerPhotoUrl(p.photo_path),
        jerseyNumber: m?.jersey_number ?? null,
        position: m?.primary_position ?? null,
        rosterOrder: m?.roster_order ?? null,
        inSeason: Boolean(m),
        legacyBaseline: b
          ? {
              games: b.games,
              hits: b.hits,
              homeRuns: b.home_runs,
              rbi: b.rbi,
              walks: b.walks,
              atBats: b.at_bats,
              battingAverageOverride:
                b.batting_average_override === null ? null : Number(b.batting_average_override),
              notes: b.notes,
            }
          : null,
      };
    })
    .sort((a, b) => {
      if (a.inSeason !== b.inSeason) return a.inSeason ? -1 : 1;
      if (a.jerseyNumber === null) return 1;
      if (b.jerseyNumber === null) return -1;
      return a.jerseyNumber - b.jerseyNumber;
    });
}

/**
 * Games whose start time has passed but which are not finalised - i.e. somebody
 * still needs to score or close them out.
 */
export async function getGamesAwaitingReview(seasonId: string) {
  const db = await createClient();
  const { data } = await db
    .from('games')
    .select('id, starts_at, game_number, opponents(name)')
    .eq('season_id', seasonId)
    .in('status', ['scheduled', 'pregame', 'live'])
    .lt('starts_at', new Date().toISOString())
    .order('starts_at', { ascending: false });

  return (data ?? []).map((g) => ({
    id: g.id,
    startsAt: g.starts_at,
    gameNumber: g.game_number,
    opponentName: g.opponents?.name ?? null,
  }));
}

export async function getPositions() {
  const db = await createClient();
  const { data } = await db
    .from('positions')
    .select('code, label, short_label, category')
    .order('sort_order');
  return data ?? [];
}

export async function getOpponents() {
  const db = await createClient();
  const { data } = await db.from('opponents').select('id, name, slug').order('name');
  return data ?? [];
}

export async function getVenues() {
  const db = await createClient();
  const { data } = await db.from('venues').select('id, name, field, display_name').order('name');
  return data ?? [];
}
