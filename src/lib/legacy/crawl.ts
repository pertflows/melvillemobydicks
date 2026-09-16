import { fetchText } from './fetch';
import {
  parseCalendar,
  parseGamePage,
  parseMediaPage,
  parsePlayerPage,
  parsePostIndex,
  parsePostPage,
  parseRosterIndex,
  parseScheduleIndex,
  parseSponsorsPage,
} from './parse';
import type { LegacySnapshot } from './types';

export interface CrawlOptions {
  baseUrl: string;
  force?: boolean;
  onProgress?: (message: string) => void;
}

/**
 * Walks the entire legacy site and returns a normalised snapshot.
 *
 * The crawl is driven by the site's own links rather than hardcoded id ranges,
 * so it stays correct if the old site gains or loses a player or a game before
 * we cut over.
 */
export async function crawlLegacySite({
  baseUrl,
  force,
  onProgress = () => {},
}: CrawlOptions): Promise<LegacySnapshot> {
  const get = (p: string) => fetchText(new URL(p, baseUrl).toString(), { force });

  onProgress('Fetching index pages');
  const [homeHtml, rosterHtml, scheduleHtml, postsHtml, mediaHtml, sponsorsHtml, icsText] =
    await Promise.all([
      get('/'),
      get('/roster'),
      get('/schedule'),
      get('/captains-log'),
      get('/media'),
      get('/sponsors'),
      get('/schedule/calendar.ics'),
    ]);

  // True absolute kickoff times, keyed by legacy game id.
  const startTimes = parseCalendar(icsText);
  onProgress(`Calendar: ${startTimes.size} game times`);

  // -- roster ---------------------------------------------------------------
  const playerUrls = parseRosterIndex(rosterHtml, baseUrl);
  onProgress(`Roster: ${playerUrls.length} players`);

  const players = [];
  for (const [i, url] of playerUrls.entries()) {
    players.push(parsePlayerPage(await get(url), url, i));
  }

  // -- schedule -------------------------------------------------------------
  // The schedule table only links the games it lists; probe the full id range it
  // implies so nothing linked from elsewhere (awards, posts) is missed.
  const scheduleUrls = new Set(parseScheduleIndex(scheduleHtml, baseUrl));
  const maxId = Math.max(
    0,
    ...[...scheduleUrls].map((u) => Number(u.match(/(\d+)$/)![1])),
    ...[...startTimes.keys()].map((k) => Number(k.replace('game-', ''))),
  );
  for (let i = 1; i <= maxId; i++) {
    scheduleUrls.add(new URL(`/schedule/${i}`, baseUrl).toString());
  }

  const games = [];
  for (const url of [...scheduleUrls].sort(
    (a, b) => Number(a.match(/(\d+)$/)![1]) - Number(b.match(/(\d+)$/)![1]),
  )) {
    let html: string;
    try {
      html = await get(url);
    } catch (err) {
      // A gap in the id sequence simply means that game was deleted upstream.
      if (err instanceof Error && /HTTP 404/.test(err.message)) continue;
      throw err;
    }
    const legacyId = `game-${url.match(/\/schedule\/(\d+)/)![1]}`;
    games.push(parseGamePage(html, url, startTimes.get(legacyId) ?? null));
  }
  onProgress(`Schedule: ${games.length} games`);

  // -- captain's log --------------------------------------------------------
  const postUrls = parsePostIndex(postsHtml, baseUrl);
  const posts = [];
  for (const url of postUrls) {
    posts.push(parsePostPage(await get(url), url));
  }
  onProgress(`Captain's Log: ${posts.length} posts`);

  // -- media ----------------------------------------------------------------
  // Union of the media page and any photos attached to individual games.
  const mediaByUrl = new Map<string, (typeof games)[number]['photos'][number]>();
  for (const m of parseMediaPage(mediaHtml, baseUrl)) mediaByUrl.set(m.url, m);
  for (const g of games) {
    for (const p of g.photos) {
      const existing = mediaByUrl.get(p.url);
      // Prefer the game-attributed record, which knows which game it belongs to.
      if (!existing || !existing.gameLegacyId) mediaByUrl.set(p.url, p);
    }
  }
  const media = [...mediaByUrl.values()];
  onProgress(`Media: ${media.length} items`);

  // -- sponsors -------------------------------------------------------------
  const sponsors = parseSponsorsPage(sponsorsHtml, baseUrl);
  onProgress(`Sponsors: ${sponsors.length}`);

  // -- branding -------------------------------------------------------------
  const logoMatch = homeHtml.match(/src="([^"]*melville_moby[^"]*)"/);
  const favicons = [...homeHtml.matchAll(/href="([^"]*favicon[^"]*)"/g)].map((m) =>
    new URL(m[1], baseUrl).toString(),
  );

  return {
    crawledAt: new Date().toISOString(),
    baseUrl,
    players,
    games,
    posts,
    media,
    sponsors,
    branding: {
      logoUrl: logoMatch ? new URL(logoMatch[1], baseUrl).toString() : null,
      faviconUrls: [...new Set(favicons)],
    },
  };
}
