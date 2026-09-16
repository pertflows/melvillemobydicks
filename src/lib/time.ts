import { TZDate } from '@date-fns/tz';
import { format } from 'date-fns';

/**
 * The team plays on Long Island. Every game time is stored as an absolute
 * instant (timestamptz) and rendered in this zone, so the schedule reads the
 * same whether a visitor opens it from Melville or from a plane.
 *
 * The legacy site stored correct UTC instants but rendered them as if they were
 * local, which is why every game there appeared to start at 9:00 or 10:15 PM
 * instead of 5:00 and 6:15.
 */
export const TEAM_TIME_ZONE = 'America/New_York';

function zoned(value: string | Date): TZDate {
  return new TZDate(typeof value === 'string' ? new Date(value) : value, TEAM_TIME_ZONE);
}

/** `Apr 15` */
export const formatGameDateShort = (v: string | Date) => format(zoned(v), 'MMM d');

/** `April 15, 2026` */
export const formatGameDateLong = (v: string | Date) => format(zoned(v), 'MMMM d, yyyy');

/** `Wed, Apr 15` */
export const formatGameDateWithDay = (v: string | Date) => format(zoned(v), 'EEE, MMM d');

/** `5:00 PM` */
export const formatGameTime = (v: string | Date) => format(zoned(v), 'h:mm a');

/** `2026-04-15`, for grouping and `<time dateTime>` */
export const formatISODate = (v: string | Date) => format(zoned(v), 'yyyy-MM-dd');

/** The calendar year a game belongs to, in team time. */
export const gameYear = (v: string | Date) => Number(format(zoned(v), 'yyyy'));
