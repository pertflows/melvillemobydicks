/**
 * The shape of a hand-corrected batting line.
 *
 * Kept free of any database import so the correction grid, which runs in the
 * browser, can use these without dragging the server client into the bundle.
 */

/** The columns a scorer corrects. Everything else keeps deriving from the plays. */
export const CORRECTABLE = ['ab', 'h', 'doubles', 'triples', 'hr', 'r', 'rbi', 'bb', 'k'] as const;

export type CorrectableStat = (typeof CORRECTABLE)[number];

/** A complete line: every column has a number. */
export type StatLine = Record<CorrectableStat, number>;

/** A correction: a column is null when the derived value still stands. */
export type EnteredLine = Record<CorrectableStat, number | null>;

export interface StatCorrectionRow {
  playerId: string;
  displayName: string;
  jerseyNumber: number | null;
  battingOrder: number | null;
  /** What the plays add up to. */
  derived: StatLine;
  /** What was entered by hand. */
  entered: EnteredLine;
  note: string | null;
}

export const EMPTY_LINE: StatLine = {
  ab: 0, h: 0, doubles: 0, triples: 0, hr: 0, r: 0, rbi: 0, bb: 0, k: 0,
};

export const NOTHING_ENTERED: EnteredLine = {
  ab: null, h: null, doubles: null, triples: null, hr: null, r: null, rbi: null, bb: null, k: null,
};

/** True when any column of this line was set by hand. */
export const isCorrected = (row: StatCorrectionRow): boolean =>
  CORRECTABLE.some((stat) => row.entered[stat] !== null);
