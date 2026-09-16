/**
 * Normalised shapes produced by the legacy crawler.
 *
 * These deliberately mirror the OLD site's vocabulary, not the new schema. The
 * crawl step is responsible for faithful extraction; the load step is
 * responsible for mapping into the new model. Keeping them separate means a
 * re-crawl never has to know about database ids.
 */

export interface LegacyStatLine {
  /** The average the old site printed, e.g. 0.575. Preserved verbatim. */
  battingAverage: number | null;
  homeRuns: number | null;
  rbi: number | null;
  hits: number | null;
  walks: number | null;
  games: number | null;
}

export interface LegacyAward {
  /** Legacy game id, when the award links to one. */
  gameLegacyId: string | null;
  opponentName: string | null;
  venueName: string | null;
  dateText: string | null;
  scoreText: string | null;
  result: 'Win' | 'Loss' | 'Tie' | null;
}

export interface LegacyPlayer {
  legacyId: string;
  sourceUrl: string;
  firstName: string;
  lastName: string;
  displayName: string;
  jerseyNumber: number | null;
  positionLabel: string | null;
  /** Paragraphs, in order, exactly as published. Never rewritten. */
  bioParagraphs: string[];
  photoUrl: string | null;
  stats: LegacyStatLine;
  awards: LegacyAward[];
  rosterOrder: number;
}

export interface LegacyGame {
  legacyId: string;
  sourceUrl: string;
  /** Absolute instant from the ICS feed. Authoritative. */
  startsAt: string | null;
  /** Date as printed on the page, kept for cross-checking the ICS. */
  dateText: string | null;
  opponentName: string | null;
  venueName: string | null;
  ourRuns: number | null;
  theirRuns: number | null;
  result: 'Win' | 'Loss' | 'Tie' | null;
  status: 'final' | 'scheduled';
  potgPlayerName: string | null;
  photos: LegacyMedia[];
}

export interface LegacyMedia {
  url: string;
  caption: string | null;
  gameLegacyId: string | null;
}

export interface LegacyPost {
  legacyId: string;
  sourceUrl: string;
  title: string;
  dateText: string | null;
  authorName: string | null;
  gameLegacyId: string | null;
  gameLabel: string | null;
  /** Paragraphs, in order, exactly as published. Never rewritten. */
  bodyParagraphs: string[];
}

export interface LegacySponsor {
  name: string;
  websiteUrl: string | null;
  logoUrl: string | null;
  sortOrder: number;
}

export interface LegacySnapshot {
  crawledAt: string;
  baseUrl: string;
  players: LegacyPlayer[];
  games: LegacyGame[];
  posts: LegacyPost[];
  media: LegacyMedia[];
  sponsors: LegacySponsor[];
  branding: { logoUrl: string | null; faviconUrls: string[] };
}
