import * as cheerio from 'cheerio';
import type {
  LegacyAward,
  LegacyGame,
  LegacyMedia,
  LegacyPlayer,
  LegacyPost,
  LegacySponsor,
  LegacyStatLine,
} from './types';

/**
 * Parsers for the legacy (Laravel/Blade) markup.
 *
 * Everything here is extraction only - no rewriting, no summarising, no
 * "improving" of copy. Player biographies and Captain's Log entries are
 * carried across exactly as they were published.
 */

const text = ($: cheerio.CheerioAPI, el: cheerio.Cheerio<never>) =>
  el.text().replace(/\s+/g, ' ').trim();

const num = (s: string | undefined | null): number | null => {
  if (s === undefined || s === null) return null;
  const cleaned = s.replace(/[^0-9.\-]/g, '');
  if (cleaned === '' || cleaned === '-' || cleaned === '.') return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
};

/** `https://mobydicks.org/schedule/7` -> `game-7` */
export function gameLegacyIdFromHref(href: string | undefined): string | null {
  const m = href?.match(/\/schedule\/(\d+)/);
  return m ? `game-${m[1]}` : null;
}

function splitName(full: string): { firstName: string; lastName: string } {
  const parts = full.trim().split(/\s+/);
  if (parts.length === 1) return { firstName: parts[0], lastName: '' };
  return {
    firstName: parts.slice(0, -1).join(' '),
    lastName: parts[parts.length - 1],
  };
}

// ---------------------------------------------------------------- roster --

/** Collects the player detail URLs from the roster index. */
export function parseRosterIndex(html: string, baseUrl: string): string[] {
  const $ = cheerio.load(html);
  const urls = new Set<string>();

  $('a[href*="/roster/"]').each((_, el) => {
    const href = $(el).attr('href');
    if (href && /\/roster\/\d+$/.test(href)) {
      urls.add(new URL(href, baseUrl).toString());
    }
  });

  return [...urls].sort(
    (a, b) => Number(a.match(/(\d+)$/)![1]) - Number(b.match(/(\d+)$/)![1]),
  );
}

export function parsePlayerPage(
  html: string,
  sourceUrl: string,
  rosterOrder: number,
): LegacyPlayer {
  const $ = cheerio.load(html);
  const main = $('main');

  const displayName = text($, main.find('h1').first() as never);
  const { firstName, lastName } = splitName(displayName);

  const jerseyText = main
    .find('span')
    .filter((_, el) => /^#\d+$/.test($(el).text().trim()))
    .first()
    .text()
    .trim();
  const jerseyNumber = num(jerseyText);

  // The position sits in the uppercase eyebrow immediately above the name.
  const positionLabel =
    text($, main.find('p.uppercase.tracking-widest').first() as never) || null;

  // Stat grid: each cell is a label <p> followed by a value <p>.
  const stats: Record<string, number | null> = {};
  main.find('div.text-center').each((_, el) => {
    const ps = $(el).find('p');
    if (ps.length >= 2) {
      const label = $(ps[0]).text().trim().toUpperCase();
      const raw = $(ps[1]).text().trim();
      stats[label] = raw === '' || raw === '-' ? null : num(raw);
    }
  });

  const statLine: LegacyStatLine = {
    battingAverage: stats['AVG'] ?? null,
    homeRuns: stats['HR'] ?? null,
    rbi: stats['RBI'] ?? null,
    hits: stats['H'] ?? null,
    walks: stats['BB'] ?? null,
    games: stats['G'] ?? null,
  };

  // Biography: a single <p> whose line breaks separate paragraphs.
  const bioEl = main.find('p.leading-relaxed').first();
  const bioParagraphs = bioEl.length
    ? bioEl
        .html()!
        .replace(/<br\s*\/?>/gi, '\n')
        .split('\n')
        .map((p) => cheerio.load(`<div>${p}</div>`)('div').text().trim())
        .filter(Boolean)
    : [];

  const photoSrc = main.find('img').first().attr('src') ?? null;
  const photoUrl = photoSrc ? new URL(photoSrc, sourceUrl).toString() : null;

  // Player of the Game history.
  const awards: LegacyAward[] = [];
  main.find('section').each((_, section) => {
    const heading = $(section).find('h2').first().text();
    if (!/Player of the Game/i.test(heading)) return;

    $(section)
      .find('div.rounded-xl')
      .each((_, row) => {
        const $row = $(row);
        const opponentName =
          $row.find('p.font-semibold').first().text().replace(/^vs\s*/i, '').trim() || null;
        const meta = $row.find('p.text-sm').first().text().trim();
        const [venuePart, datePart] = meta.split('·').map((s) => s.trim());
        const scoreText = $row.find('span.font-bold').first().text().trim() || null;
        const resultRaw = $row.find('span.rounded-full').first().text().trim();

        awards.push({
          gameLegacyId: gameLegacyIdFromHref($row.find('a').attr('href')),
          opponentName,
          venueName: venuePart || null,
          dateText: datePart || null,
          scoreText,
          result:
            resultRaw === 'Win' ? 'Win' : resultRaw === 'Loss' ? 'Loss' : resultRaw === 'Tie' ? 'Tie' : null,
        });
      });
  });

  const idMatch = sourceUrl.match(/\/roster\/(\d+)/);

  return {
    legacyId: `player-${idMatch ? idMatch[1] : displayName}`,
    sourceUrl,
    firstName,
    lastName,
    displayName,
    jerseyNumber,
    positionLabel,
    bioParagraphs,
    photoUrl,
    stats: statLine,
    awards,
    rosterOrder,
  };
}

// -------------------------------------------------------------- schedule --

/**
 * The ICS feed is the only place the legacy site exposes true absolute game
 * times. The HTML pages render those same instants as if UTC were local, which
 * is why every game appears to start at 9:00 or 10:15 PM there.
 */
export function parseCalendar(ics: string): Map<string, string> {
  const byGame = new Map<string, string>();
  const events = ics.split('BEGIN:VEVENT').slice(1);

  for (const ev of events) {
    const uid = ev.match(/UID:game-(\d+)@/)?.[1];
    const dtstart = ev.match(/DTSTART:(\d{8}T\d{6}Z)/)?.[1];
    if (!uid || !dtstart) continue;

    const iso = dtstart.replace(
      /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/,
      '$1-$2-$3T$4:$5:$6Z',
    );
    byGame.set(`game-${uid}`, new Date(iso).toISOString());
  }

  return byGame;
}

/** Collects game detail URLs from the schedule table's row click handlers. */
export function parseScheduleIndex(html: string, baseUrl: string): string[] {
  const $ = cheerio.load(html);
  const urls = new Set<string>();

  $('tr[onclick]').each((_, el) => {
    const m = $(el).attr('onclick')?.match(/\/schedule\/(\d+)/);
    if (m) urls.add(new URL(`/schedule/${m[1]}`, baseUrl).toString());
  });

  return [...urls].sort(
    (a, b) => Number(a.match(/(\d+)$/)![1]) - Number(b.match(/(\d+)$/)![1]),
  );
}

export function parseGamePage(
  html: string,
  sourceUrl: string,
  startsAt: string | null,
): LegacyGame {
  const $ = cheerio.load(html);
  const main = $('main');

  const dateText =
    main
      .find('*')
      .filter((_, el) => /^[A-Z][a-z]+ \d{1,2}, \d{4}/.test($(el).text().trim()))
      .first()
      .text()
      .trim()
      .split('·')[0]
      ?.trim() || null;

  const opponentName =
    main
      .find('*')
      .filter((_, el) => {
        const t = $(el).text().trim();
        return /^vs\s+\S/.test(t) && t.length < 60 && $(el).children().length === 0;
      })
      .first()
      .text()
      .replace(/^vs\s*/i, '')
      .trim() || null;

  // The venue line sits with the date in the game header.
  const venueName =
    main
      .find('*')
      .filter((_, el) => {
        const t = $(el).text().trim();
        return (
          $(el).children().length === 0 &&
          /(Park|Complex|Field|Stadium|Diamond)/i.test(t) &&
          t.length < 80
        );
      })
      .first()
      .text()
      .trim() || null;

  const isUpcoming = /Upcoming/i.test(main.text());

  // Score is rendered as two large numerals separated by a dash.
  let ourRuns: number | null = null;
  let theirRuns: number | null = null;
  const scoreMatch = main
    .text()
    .replace(/\s+/g, ' ')
    .match(/(\d{1,2})\s*[–-]\s*(\d{1,2})/);
  if (scoreMatch && !isUpcoming) {
    ourRuns = Number(scoreMatch[1]);
    theirRuns = Number(scoreMatch[2]);
  }

  const resultRaw = main.find('span, p').filter((_, el) => {
    const t = $(el).text().trim();
    return t === 'Win' || t === 'Loss' || t === 'Tie';
  }).first().text().trim();

  // Player of the Game, when the game has one.
  let potgPlayerName: string | null = null;
  main.find('section, div').each((_, el) => {
    if (potgPlayerName) return;
    const $el = $(el);
    if (!/Player of the Game/i.test($el.text())) return;
    const name = $el.find('h2, h3, p.font-bold, p.font-semibold').filter((_, n) => {
      const t = $(n).text().trim();
      return /^[A-Z][a-z]+ [A-Z]/.test(t) && !/Player of the Game/i.test(t);
    }).first().text().trim();
    if (name) potgPlayerName = name;
  });

  const legacyId = `game-${sourceUrl.match(/\/schedule\/(\d+)/)![1]}`;

  const photos: LegacyMedia[] = [];
  main.find('[data-lightbox-src]').each((_, el) => {
    const url = $(el).attr('data-lightbox-src');
    if (!url) return;
    photos.push({
      url: new URL(url, sourceUrl).toString(),
      caption: $(el).attr('data-lightbox-title')?.trim() || null,
      gameLegacyId: legacyId,
    });
  });

  return {
    legacyId,
    sourceUrl,
    startsAt,
    dateText,
    opponentName,
    venueName,
    ourRuns,
    theirRuns,
    result:
      resultRaw === 'Win' ? 'Win' : resultRaw === 'Loss' ? 'Loss' : resultRaw === 'Tie' ? 'Tie' : null,
    status: isUpcoming ? 'scheduled' : 'final',
    potgPlayerName,
    photos,
  };
}

// ---------------------------------------------------------- captain's log --

export function parsePostIndex(html: string, baseUrl: string): string[] {
  const $ = cheerio.load(html);
  const urls = new Set<string>();

  $('a[href*="/captains-log/"]').each((_, el) => {
    const href = $(el).attr('href');
    if (href && /\/captains-log\/\d+$/.test(href)) {
      urls.add(new URL(href, baseUrl).toString());
    }
  });

  return [...urls].sort(
    (a, b) => Number(a.match(/(\d+)$/)![1]) - Number(b.match(/(\d+)$/)![1]),
  );
}

export function parsePostPage(html: string, sourceUrl: string): LegacyPost {
  const $ = cheerio.load(html);
  const article = $('article').length ? $('article') : $('main');

  const title = text($, article.find('h1').first() as never);

  const metaSpans = article.find('div').first().find('span');
  const metaTexts = metaSpans
    .map((_, el) => $(el).text().trim())
    .get()
    .filter((t) => t && t !== '·');

  const dateText = metaTexts[0] ?? null;
  const authorName = metaTexts[1] && !/^vs /i.test(metaTexts[1]) ? metaTexts[1] : null;
  const gameLabel = metaTexts.find((t) => /^vs /i.test(t)) ?? null;
  const gameLegacyId = gameLegacyIdFromHref(article.find('a[href*="/schedule/"]').attr('href'));

  const bodyParagraphs = article
    .find('.prose p')
    .map((_, el) => $(el).text().replace(/\s+/g, ' ').trim())
    .get()
    .filter(Boolean);

  return {
    legacyId: `post-${sourceUrl.match(/\/captains-log\/(\d+)/)![1]}`,
    sourceUrl,
    title,
    dateText,
    authorName,
    gameLegacyId,
    gameLabel,
    bodyParagraphs,
  };
}

// ----------------------------------------------------------------- media --

export function parseMediaPage(html: string, baseUrl: string): LegacyMedia[] {
  const $ = cheerio.load(html);
  const out: LegacyMedia[] = [];

  $('[data-lightbox-src]').each((_, el) => {
    const url = $(el).attr('data-lightbox-src');
    if (!url) return;

    // Photos are grouped under a heading that links to their game, when known.
    const group = $(el).closest('div.mb-8');
    const gameLegacyId = gameLegacyIdFromHref(group.find('a[href*="/schedule/"]').attr('href'));

    out.push({
      url: new URL(url, baseUrl).toString(),
      caption: $(el).attr('data-lightbox-title')?.trim() || null,
      gameLegacyId,
    });
  });

  return out;
}

// -------------------------------------------------------------- sponsors --

export function parseSponsorsPage(html: string, baseUrl: string): LegacySponsor[] {
  const $ = cheerio.load(html);
  const out: LegacySponsor[] = [];

  $('main h3').each((i, el) => {
    const card = $(el).closest('div');
    const name = $(el).text().trim();
    if (!name) return;

    const logoSrc = card.find('img').first().attr('src');
    const href = card.find('a[href^="http"]').first().attr('href');

    out.push({
      name,
      websiteUrl: href ?? null,
      logoUrl: logoSrc ? new URL(logoSrc, baseUrl).toString() : null,
      sortOrder: i,
    });
  });

  return out;
}
