import type { SupabaseClient } from '@supabase/supabase-js';
import { TZDate } from '@date-fns/tz';
import type { Database } from '../supabase/database.types';
import { TEAM_TIME_ZONE } from '../time';
import { processImage, storageKeyFromUrl } from './images';
import type { LegacyGame, LegacyPost, LegacySnapshot } from './types';

type Db = SupabaseClient<Database>;

/**
 * Maps a crawled snapshot into the new schema.
 *
 * Every insert is keyed on `legacy_id`, so the importer is idempotent: running
 * it twice updates rather than duplicates, and a re-crawl after the old site
 * changes will reconcile instead of forking.
 */

export interface LoadOptions {
  db: Db;
  snapshot: LegacySnapshot;
  skipMedia?: boolean;
  onProgress?: (message: string) => void;
}

export interface LoadReport {
  seasons: number;
  players: number;
  playerSeasons: number;
  legacyBaselines: number;
  opponents: number;
  venues: number;
  games: number;
  awards: number;
  posts: number;
  media: number;
  sponsors: number;
  warnings: string[];
}

/** Legacy position labels -> position codes in the new reference table. */
const POSITION_CODES: Record<string, string> = {
  'starting pitcher': 'SP',
  'relief pitcher': 'RP',
  pitcher: 'P',
  catcher: 'C',
  'first baseman': '1B',
  'second baseman': '2B',
  'third baseman': '3B',
  shortstop: 'SS',
  infielder: 'IF',
  'left fielder': 'LF',
  'center fielder': 'CF',
  'right fielder': 'RF',
  outfielder: 'OF',
  rover: 'ROV',
  'extra hitter': 'EH',
  'designated hitter': 'DH',
};

function positionCode(label: string | null): string | null {
  if (!label) return null;
  return POSITION_CODES[label.trim().toLowerCase()] ?? null;
}

export function slugify(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

/** `Cantiague Park - Field D` -> { name, field } */
export function splitVenue(display: string): { name: string; field: string | null } {
  const m = display.match(/^(.*?)\s+-\s+(.*)$/);
  return m ? { name: m[1].trim(), field: m[2].trim() } : { name: display.trim(), field: null };
}

/** Normalises a name for fuzzy matching ("Nick Caracappa" vs "Nicholas Caracappa"). */
function nameKey(name: string): string {
  return name.toLowerCase().replace(/[^a-z ]/g, '').replace(/\s+/g, ' ').trim();
}

/** Local calendar date of a game, in team time. */
function localDate(iso: string): string {
  const d = new TZDate(new Date(iso), TEAM_TIME_ZONE);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** `May 13, 2026` -> an instant at noon team-time, for posts with no clock time. */
function parseLooseDate(text: string | null): string | null {
  if (!text) return null;
  const parsed = new Date(`${text} 12:00:00`);
  if (Number.isNaN(parsed.getTime())) return null;
  const [y, m, d] = [parsed.getFullYear(), parsed.getMonth(), parsed.getDate()];
  return new TZDate(y, m, d, 12, 0, 0, TEAM_TIME_ZONE).toISOString();
}

export async function loadSnapshot({
  db,
  snapshot,
  skipMedia = false,
  onProgress = () => {},
}: LoadOptions): Promise<LoadReport> {
  const warnings: string[] = [];
  const report: LoadReport = {
    seasons: 0, players: 0, playerSeasons: 0, legacyBaselines: 0,
    opponents: 0, venues: 0, games: 0, awards: 0, posts: 0, media: 0,
    sponsors: 0, warnings,
  };

  // ------------------------------------------------------------- seasons --
  // Derived from the data rather than hardcoded, so a re-crawl after the 2027
  // season starts creates 2027 without a code change.
  const years = new Set<number>();
  for (const g of snapshot.games) {
    if (g.startsAt) years.add(new TZDate(new Date(g.startsAt), TEAM_TIME_ZONE).getFullYear());
  }
  if (years.size === 0) years.add(new Date().getFullYear());

  const currentYear = Math.max(...years);
  const seasonIdByYear = new Map<number, string>();

  for (const year of [...years].sort()) {
    const { data, error } = await db
      .from('seasons')
      .upsert(
        {
          year,
          name: String(year),
          slug: String(year),
          league_name: 'ABA',
          is_current: year === currentYear,
          sort_order: year,
        },
        { onConflict: 'slug' },
      )
      .select('id, year')
      .single();
    if (error) throw new Error(`seasons: ${error.message}`);
    seasonIdByYear.set(data.year, data.id);
    report.seasons++;
  }
  const currentSeasonId = seasonIdByYear.get(currentYear)!;
  onProgress(`Seasons: ${report.seasons}`);

  // ----------------------------------------------------------- opponents --
  const opponentIdByName = new Map<string, string>();
  const opponentNames = [
    ...new Set(snapshot.games.map((g) => g.opponentName).filter((n): n is string => !!n)),
  ];

  for (const name of opponentNames) {
    const { data, error } = await db
      .from('opponents')
      .upsert({ name, slug: slugify(name) }, { onConflict: 'slug' })
      .select('id')
      .single();
    if (error) throw new Error(`opponents(${name}): ${error.message}`);
    opponentIdByName.set(name, data.id);
    report.opponents++;
  }
  onProgress(`Opponents: ${report.opponents}`);

  // -------------------------------------------------------------- venues --
  const venueIdByDisplay = new Map<string, string>();
  const venueDisplays = [
    ...new Set(snapshot.games.map((g) => g.venueName).filter((n): n is string => !!n)),
  ];

  for (const display of venueDisplays) {
    const { name, field } = splitVenue(display);
    const { data, error } = await db
      .from('venues')
      .upsert(
        { name, field, slug: slugify(display), city: 'Hicksville', state: 'NY' },
        { onConflict: 'slug' },
      )
      .select('id')
      .single();
    if (error) throw new Error(`venues(${display}): ${error.message}`);
    venueIdByDisplay.set(display, data.id);
    report.venues++;
  }
  onProgress(`Venues: ${report.venues}`);

  // ------------------------------------------------------------- players --
  const playerIdByLegacy = new Map<string, string>();
  const playerIdByName = new Map<string, string>();

  for (const p of snapshot.players) {
    const { data, error } = await db
      .from('players')
      .upsert(
        {
          legacy_id: p.legacyId,
          first_name: p.firstName,
          last_name: p.lastName,
          display_name: p.displayName,
          slug: slugify(p.displayName),
          // Biographies are carried over verbatim. Never regenerated.
          bio: p.bioParagraphs.join('\n\n') || null,
          status: 'active',
          primary_position: positionCode(p.positionLabel),
          legacy_position_label: p.positionLabel,
        },
        { onConflict: 'legacy_id' },
      )
      .select('id')
      .single();
    if (error) throw new Error(`players(${p.displayName}): ${error.message}`);

    playerIdByLegacy.set(p.legacyId, data.id);
    playerIdByName.set(nameKey(p.displayName), data.id);
    // Also index by last name for POTG lines that use a short first name.
    playerIdByName.set(nameKey(p.lastName), data.id);
    report.players++;

    // Season roster membership: jersey and position live here, not on players.
    const { error: psErr } = await db.from('player_seasons').upsert(
      {
        player_id: data.id,
        season_id: currentSeasonId,
        jersey_number: p.jerseyNumber,
        primary_position: positionCode(p.positionLabel),
        status: 'active',
        roster_order: p.rosterOrder,
      },
      { onConflict: 'player_id,season_id' },
    );
    if (psErr) throw new Error(`player_seasons(${p.displayName}): ${psErr.message}`);
    report.playerSeasons++;

    // Legacy baseline: exactly what the old site published, nothing inferred.
    // at_bats / plate_appearances stay NULL because the old site never showed
    // them and deriving them from AVG would invent plate appearances.
    const s = p.stats;
    const hasAnyStat =
      [s.games, s.hits, s.homeRuns, s.walks, s.rbi, s.battingAverage].some(
        (v) => v !== null && v !== undefined,
      );

    if (hasAnyStat) {
      const { error: lbErr } = await db.from('legacy_stat_baselines').upsert(
        {
          player_id: data.id,
          season_id: currentSeasonId,
          games: s.games,
          hits: s.hits,
          home_runs: s.homeRuns,
          walks: s.walks,
          rbi: s.rbi,
          at_bats: null,
          plate_appearances: null,
          batting_average_override: s.battingAverage,
          source_url: p.sourceUrl,
          notes:
            'Imported from the legacy site, which published AVG/HR/RBI/H/BB/G only. ' +
            'At-bats and plate appearances were never published and are unknown; ' +
            'they are intentionally NULL rather than derived from the average.',
        },
        { onConflict: 'player_id,season_id' },
      );
      if (lbErr) throw new Error(`legacy_stat_baselines(${p.displayName}): ${lbErr.message}`);
      report.legacyBaselines++;
    }
  }
  onProgress(`Players: ${report.players} (+${report.legacyBaselines} legacy baselines)`);

  // --------------------------------------------------------------- games --
  // Doubleheaders: same local date + same opponent, ordered by start time.
  const seriesCounts = new Map<string, LegacyGame[]>();
  for (const g of snapshot.games) {
    if (!g.startsAt || !g.opponentName) continue;
    const key = `${localDate(g.startsAt)}-${slugify(g.opponentName)}`;
    const list = seriesCounts.get(key) ?? [];
    list.push(g);
    seriesCounts.set(key, list);
  }
  for (const list of seriesCounts.values()) {
    list.sort((a, b) => (a.startsAt! < b.startsAt! ? -1 : 1));
  }

  const gameNumberByLegacyId = new Map<string, { seriesKey: string; gameNumber: number }>();
  for (const [key, list] of seriesCounts) {
    list.forEach((g, i) => {
      gameNumberByLegacyId.set(g.legacyId, { seriesKey: key, gameNumber: i + 1 });
    });
  }

  const gameIdByLegacy = new Map<string, string>();

  for (const g of snapshot.games) {
    if (!g.startsAt) {
      warnings.push(`${g.legacyId}: no start time in the calendar feed; skipped`);
      continue;
    }

    const season =
      seasonIdByYear.get(new TZDate(new Date(g.startsAt), TEAM_TIME_ZONE).getFullYear()) ??
      currentSeasonId;
    const series = gameNumberByLegacyId.get(g.legacyId);

    const { data, error } = await db
      .from('games')
      .upsert(
        {
          legacy_id: g.legacyId,
          season_id: season,
          opponent_id: g.opponentName ? opponentIdByName.get(g.opponentName) ?? null : null,
          venue_id: g.venueName ? venueIdByDisplay.get(g.venueName) ?? null : null,
          starts_at: g.startsAt,
          status: g.status,
          // The legacy site framed every game as "vs", i.e. home.
          home_away: 'home',
          series_key: series?.seriesKey ?? null,
          game_number: series?.gameNumber ?? 1,
          // Recorded score only - these games have no event-level detail, so
          // the scoreboard view falls back to these columns for them.
          our_runs_recorded: g.ourRuns,
          their_runs_recorded: g.theirRuns,
          finalized_at: g.status === 'final' ? g.startsAt : null,
        },
        { onConflict: 'legacy_id' },
      )
      .select('id')
      .single();
    if (error) throw new Error(`games(${g.legacyId}): ${error.message}`);

    gameIdByLegacy.set(g.legacyId, data.id);
    report.games++;
  }
  onProgress(`Games: ${report.games}`);

  // -------------------------------------------------------------- awards --
  for (const g of snapshot.games) {
    if (!g.potgPlayerName) continue;
    const gameId = gameIdByLegacy.get(g.legacyId);
    if (!gameId) continue;

    const playerId =
      playerIdByName.get(nameKey(g.potgPlayerName)) ??
      playerIdByName.get(nameKey(g.potgPlayerName.split(' ').slice(-1)[0]));

    if (!playerId) {
      warnings.push(`${g.legacyId}: Player of the Game "${g.potgPlayerName}" did not match a roster player`);
      continue;
    }

    const { error } = await db.from('player_awards').upsert(
      {
        legacy_id: `potg-${g.legacyId}`,
        player_id: playerId,
        award_code: 'potg',
        game_id: gameId,
        season_id: seasonIdByYear.get(
          new TZDate(new Date(g.startsAt!), TEAM_TIME_ZONE).getFullYear(),
        ) ?? currentSeasonId,
        awarded_on: localDate(g.startsAt!),
      },
      { onConflict: 'legacy_id' },
    );
    if (error) throw new Error(`player_awards(${g.legacyId}): ${error.message}`);
    report.awards++;
  }
  onProgress(`Awards: ${report.awards}`);

  // --------------------------------------------------------------- posts --
  for (const post of snapshot.posts) {
    const gameId = resolvePostGame(post, snapshot, gameIdByLegacy, warnings);
    const linkedGame = snapshot.games.find((g) => gameIdByLegacy.get(g.legacyId) === gameId);

    const publishedAt =
      linkedGame?.startsAt ?? parseLooseDate(post.dateText) ?? new Date().toISOString();

    const authorId = post.authorName
      ? playerIdByName.get(nameKey(post.authorName)) ?? null
      : null;

    const { error } = await db.from('captains_log_posts').upsert(
      {
        legacy_id: post.legacyId,
        title: post.title,
        slug: slugify(post.title),
        // Body carried over verbatim, paragraph breaks preserved.
        body: post.bodyParagraphs.join('\n\n'),
        excerpt: post.bodyParagraphs[0]?.slice(0, 280) ?? null,
        author_player_id: authorId,
        author_name: post.authorName,
        game_id: gameId,
        season_id: currentSeasonId,
        published_at: publishedAt,
        is_published: true,
      },
      { onConflict: 'legacy_id' },
    );
    if (error) throw new Error(`captains_log_posts(${post.legacyId}): ${error.message}`);
    report.posts++;
  }
  onProgress(`Posts: ${report.posts}`);

  // --------------------------------------------------------------- media --
  if (!skipMedia) {
    // Player photos.
    for (const p of snapshot.players) {
      if (!p.photoUrl) continue;
      const playerId = playerIdByLegacy.get(p.legacyId)!;

      try {
        const img = await processImage(p.photoUrl, { maxEdge: 1600 });
        const key = storageKeyFromUrl(p.photoUrl);

        const optimizedPath = `${slugify(p.displayName)}-${key}.webp`;
        await upload(db, 'players', optimizedPath, img.optimized, 'image/webp');

        const originalPath = `players/${key}.${p.photoUrl.split('.').pop()?.toLowerCase()}`;
        await upload(db, 'originals', originalPath, img.original, img.originalContentType);

        const { error } = await db
          .from('players')
          .update({
            photo_path: optimizedPath,
            photo_original_path: originalPath,
            photo_width: img.width,
            photo_height: img.height,
            photo_placeholder: img.placeholder,
          })
          .eq('id', playerId);
        if (error) throw new Error(error.message);
        report.media++;
        onProgress(`  photo: ${p.displayName} (${img.originalFormat} -> webp)`);
      } catch (err) {
        warnings.push(`${p.displayName}: photo failed - ${(err as Error).message}`);
      }
    }

    // Game and gallery photos.
    for (const [i, m] of snapshot.media.entries()) {
      try {
        const img = await processImage(m.url, { maxEdge: 2000 });
        const key = storageKeyFromUrl(m.url);
        const ext = m.url.split('.').pop()?.toLowerCase() ?? 'bin';

        const optimizedPath = `${key}.webp`;
        await upload(db, 'media', optimizedPath, img.optimized, 'image/webp');

        const originalPath = `media/${key}.${ext}`;
        await upload(db, 'originals', originalPath, img.original, img.originalContentType);

        const { error } = await db.from('media').upsert(
          {
            legacy_id: `media-${key}`,
            kind: 'photo',
            storage_path: optimizedPath,
            original_path: originalPath,
            original_format: img.originalFormat,
            width: img.width,
            height: img.height,
            placeholder: img.placeholder,
            byte_size: img.bytes,
            caption: m.caption,
            alt_text: m.caption,
            game_id: m.gameLegacyId ? gameIdByLegacy.get(m.gameLegacyId) ?? null : null,
            season_id: currentSeasonId,
            sort_order: i,
          },
          { onConflict: 'legacy_id' },
        );
        if (error) throw new Error(error.message);
        report.media++;
        onProgress(`  media: ${key} (${img.originalFormat} -> webp)`);
      } catch (err) {
        warnings.push(`media ${m.url}: ${(err as Error).message}`);
      }
    }

    // Team mark.
    if (snapshot.branding.logoUrl) {
      try {
        const img = await processImage(snapshot.branding.logoUrl, { maxEdge: 1024 });
        await upload(db, 'branding', 'moby-dicks-logo.webp', img.optimized, 'image/webp');
        await upload(db, 'branding', 'moby-dicks-logo.png', img.original, 'image/png');
        report.media++;
      } catch (err) {
        warnings.push(`branding logo: ${(err as Error).message}`);
      }
    }
  }
  onProgress(`Media: ${report.media}`);

  // ------------------------------------------------------------ sponsors --
  for (const s of snapshot.sponsors) {
    let logoPath: string | null = null;

    if (s.logoUrl && !skipMedia) {
      try {
        const img = await processImage(s.logoUrl, { maxEdge: 600 });
        logoPath = `sponsors/${slugify(s.name)}.webp`;
        await upload(db, 'branding', logoPath, img.optimized, 'image/webp');
      } catch (err) {
        warnings.push(`sponsor ${s.name} logo: ${(err as Error).message}`);
      }
    }

    const { error } = await db.from('sponsors').upsert(
      {
        legacy_id: `sponsor-${slugify(s.name)}`,
        name: s.name,
        slug: slugify(s.name),
        website_url: s.websiteUrl,
        ...(logoPath ? { logo_path: logoPath } : {}),
        sort_order: s.sortOrder,
        is_active: true,
      },
      { onConflict: 'legacy_id' },
    );
    if (error) throw new Error(`sponsors(${s.name}): ${error.message}`);
    report.sponsors++;
  }
  onProgress(`Sponsors: ${report.sponsors}`);

  return report;
}

/**
 * Links a Captain's Log entry to its game.
 *
 * The legacy post pages name the matchup ("vs Screwballs - May 13, 2026") but
 * never link to it, and the titles are "Post Game Report - Game N". Match on
 * the title's game number first, confirm it against the named opponent, and
 * fall back to matching opponent plus date.
 */
function resolvePostGame(
  post: LegacyPost,
  snapshot: LegacySnapshot,
  gameIdByLegacy: Map<string, string>,
  warnings: string[],
): string | null {
  if (post.gameLegacyId) return gameIdByLegacy.get(post.gameLegacyId) ?? null;

  const labelOpponent = post.gameLabel?.replace(/^vs\s*/i, '').split('·')[0]?.trim() ?? null;
  const labelDate = post.gameLabel?.split('·')[1]?.trim() ?? null;

  const titleNumber = post.title.match(/Game\s+(\d+)/i)?.[1];
  if (titleNumber) {
    const candidate = snapshot.games.find((g) => g.legacyId === `game-${titleNumber}`);
    if (
      candidate &&
      (!labelOpponent ||
        candidate.opponentName?.toLowerCase() === labelOpponent.toLowerCase())
    ) {
      return gameIdByLegacy.get(candidate.legacyId) ?? null;
    }
  }

  if (labelOpponent && labelDate) {
    const target = parseLooseDate(labelDate);
    const matches = snapshot.games.filter(
      (g) =>
        g.opponentName?.toLowerCase() === labelOpponent.toLowerCase() &&
        g.startsAt &&
        target &&
        localDate(g.startsAt) === localDate(target),
    );
    if (matches.length === 1) return gameIdByLegacy.get(matches[0].legacyId) ?? null;
    if (matches.length > 1) {
      warnings.push(`${post.legacyId}: "${post.title}" matched ${matches.length} games; left unlinked`);
      return null;
    }
  }

  warnings.push(`${post.legacyId}: "${post.title}" could not be linked to a game`);
  return null;
}

/** Uploads to Storage, overwriting so re-runs converge. */
async function upload(
  db: Db,
  bucket: string,
  path: string,
  body: Buffer,
  contentType: string,
): Promise<void> {
  const { error } = await db.storage
    .from(bucket)
    .upload(path, body, { contentType, upsert: true });
  if (error) throw new Error(`storage ${bucket}/${path}: ${error.message}`);
}
