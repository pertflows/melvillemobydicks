/**
 * Display formatting for statistics.
 *
 * Baseball/softball rate stats are conventionally written without a leading
 * zero (`.568`, not `0.568`). The legacy site printed `0.568` on every page;
 * this is the single place the new site gets it right.
 */

/** `.568`, `1.204`, `—` for unknown. Used for AVG, OBP, SLG, OPS. */
export function formatRate(value: number | string | null | undefined): string {
  if (value === null || value === undefined || value === '') return '—';

  const n = typeof value === 'string' ? Number(value) : value;
  if (!Number.isFinite(n)) return '—';

  const fixed = Math.abs(n).toFixed(3);
  const sign = n < 0 ? '-' : '';

  // Strip the leading zero only when the magnitude is below 1.000.
  return sign + (fixed.startsWith('0.') ? fixed.slice(1) : fixed);
}

/** Counting stats. `—` when genuinely unknown, `0` when known to be zero. */
export function formatCount(value: number | null | undefined): string {
  if (value === null || value === undefined) return '—';
  return String(value);
}

/** `18–16` with an en dash, as scores are set in print. */
export function formatScore(ours: number | null, theirs: number | null): string {
  if (ours === null || theirs === null) return '—';
  return `${ours}–${theirs}`;
}

/** `20–6` record, ties appended only when they exist. */
export function formatRecord(wins: number, losses: number, ties = 0): string {
  return ties > 0 ? `${wins}–${losses}–${ties}` : `${wins}–${losses}`;
}

/** `#26`, or an empty string when a player has no number this season. */
export function formatJersey(n: number | null | undefined): string {
  return n === null || n === undefined ? '' : `#${n}`;
}

/** `BOT 4` / `TOP 7` — the broadcast inning label. */
export function formatInning(half: 'top' | 'bottom' | null, inning: number | null): string {
  if (!half || !inning) return '';
  return `${half === 'top' ? 'TOP' : 'BOT'} ${inning}`;
}

/** `2 OUT` / `1 OUT` / `0 OUT`, pluralised correctly. */
export function formatOuts(outs: number | null | undefined): string {
  const n = outs ?? 0;
  return `${n} OUT`;
}

/** Ordinal suffix for bases and innings: 1st, 2nd, 3rd, 4th. */
export function ordinal(n: number): string {
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${n}th`;
  switch (n % 10) {
    case 1:
      return `${n}st`;
    case 2:
      return `${n}nd`;
    case 3:
      return `${n}rd`;
    default:
      return `${n}th`;
  }
}

/**
 * Describes base state in words, for screen readers and the event feed.
 * `bases` is [first, second, third] occupancy.
 */
export function describeBases(bases: [boolean, boolean, boolean]): string {
  const occupied = (['first', 'second', 'third'] as const).filter((_, i) => bases[i]);
  if (occupied.length === 0) return 'Bases empty';
  if (occupied.length === 3) return 'Bases loaded';
  if (occupied.length === 1) return `Runner on ${occupied[0]}`;
  return `Runners on ${occupied[0]} and ${occupied[1]}`;
}
