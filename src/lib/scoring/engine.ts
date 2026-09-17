/**
 * The scoring engine.
 *
 * Pure functions with no database or React dependencies, so game state is
 * derived the same way on the server, in the browser, and in tests.
 *
 * The plate appearance log is the source of truth. Game state - inning, outs,
 * base occupancy, score, who is due up - is REPLAYED from that log rather than
 * stored and mutated. That is what makes "undo" a delete and makes correcting
 * an old play fix everything downstream automatically.
 */

export type Base = 0 | 1 | 2 | 3 | 4; // 0 = batter's box, 4 = home
export type Half = 'top' | 'bottom';

export interface RunnerMovement {
  runnerId: string | null;
  startBase: Base;
  endBase: Base | null;
  isOut: boolean;
  rbiCredited: boolean;
}

export interface PlateAppearanceRecord {
  id: string;
  sequence: number;
  inning: number;
  half: Half;
  batterId: string | null;
  lineupSpot: number | null;
  resultCode: string;
  outsBefore: number;
  outsOnPlay: number;
  movements: RunnerMovement[];
}

export interface ResultType {
  code: string;
  label: string;
  shortLabel: string;
  countsAsAb: boolean;
  isHit: boolean;
  totalBases: number;
  isWalk: boolean;
  isHbp: boolean;
  isStrikeout: boolean;
  isSacFly: boolean;
  isSacBunt: boolean;
  isError: boolean;
  isFieldersChoice: boolean;
  batterReaches: boolean;
  defaultOuts: number;
}

export interface GameState {
  inning: number;
  half: Half;
  outs: number;
  /** Runner ids on first, second, third. */
  bases: [string | null, string | null, string | null];
  ourRuns: number;
  theirRuns: number;
  /** Index into the batting order of the player due up. */
  battingIndex: number;
  /** True when the half-inning we bat in is the current one. */
  isOurHalf: boolean;
  complete: boolean;
}

/** Which half of an inning our team bats in. */
export function ourHalf(homeAway: 'home' | 'away'): Half {
  return homeAway === 'home' ? 'bottom' : 'top';
}

export interface ReplayInput {
  plateAppearances: PlateAppearanceRecord[];
  /** Opponent runs entered per inning. */
  inningRuns: { inning: number; theirRuns: number }[];
  lineupSize: number;
  /**
   * Player ids in the current batting order.
   *
   * Editing the lineup mid-game renumbers the spots, which leaves the spot
   * recorded on an earlier appearance pointing somewhere else. Given the order
   * as it stands now, who is due up is worked out from the last batter rather
   * than from the number written next to them at the time.
   */
  lineupPlayerIds?: string[];
  /** A scorekeeper's correction to the inning and outs, if there is one. */
  stateOverride?: StateOverride | null;
  homeAway: 'home' | 'away';
  scheduledInnings: number;
}

/**
 * A hand-set inning and outs.
 *
 * Both are otherwise replayed from the log, so this exists for the case the log
 * cannot cover: an out that was never recorded, or an inning that turned over
 * off-screen. It takes effect once every appearance up to afterSequence has
 * been replayed, so plays recorded before the correction are untouched and
 * plays recorded after it carry on from the corrected state.
 */
export interface StateOverride {
  afterSequence: number;
  inning: number | null;
  outs: number | null;
}

/**
 * Replays the log into the current state of the game.
 *
 * Three outs close the half-inning: outs reset, the bases clear, and play moves
 * to our next turn at bat. The batting order continues where it left off, which
 * is why battingIndex is carried across innings rather than recomputed.
 */
export function replayGame({
  plateAppearances,
  inningRuns,
  lineupSize,
  lineupPlayerIds,
  stateOverride,
  homeAway,
  scheduledInnings,
}: ReplayInput): GameState {
  const weBat = ourHalf(homeAway);
  const spotOf = new Map((lineupPlayerIds ?? []).map((id, i) => [id, i]));

  const state: GameState = {
    inning: 1,
    half: weBat,
    outs: 0,
    bases: [null, null, null],
    ourRuns: 0,
    theirRuns: inningRuns.reduce((sum, i) => sum + (i.theirRuns ?? 0), 0),
    battingIndex: 0,
    isOurHalf: true,
    complete: false,
  };

  const ordered = [...plateAppearances].sort((a, b) => a.sequence - b.sequence);

  /**
   * The scorekeeper's correction, applied once the log has been replayed up to
   * the point they made it. Moving the inning starts that inning properly -
   * nobody on, nobody out - before any hand-set out count is put back.
   */
  let pending = stateOverride ?? null;
  const applyOverride = () => {
    if (!pending) return;

    if (pending.inning !== null && pending.inning !== state.inning) {
      state.inning = pending.inning;
      state.outs = 0;
      state.bases = [null, null, null];
    }
    if (pending.outs !== null) state.outs = pending.outs;

    pending = null;
  };

  for (const pa of ordered) {
    if (pending && pa.sequence > pending.afterSequence) applyOverride();

    // A recorded appearance in a later inning means the previous half ended.
    if (pa.inning !== state.inning) {
      state.inning = pa.inning;
      state.outs = 0;
      state.bases = [null, null, null];
    }

    state.half = pa.half;

    for (const m of pa.movements) {
      if (m.startBase >= 1 && m.startBase <= 3) {
        state.bases[m.startBase - 1] = null;
      }
    }

    for (const m of pa.movements) {
      if (m.isOut) continue;
      if (m.endBase === 4) state.ourRuns += 1;
      else if (m.endBase !== null && m.endBase >= 1 && m.endBase <= 3) {
        state.bases[m.endBase - 1] = m.runnerId;
      }
    }

    state.outs += pa.outsOnPlay;

    const current = pa.batterId !== null ? spotOf.get(pa.batterId) : undefined;

    if (current !== undefined && lineupSize > 0) {
      // Where this batter stands in the order now, not where they stood then.
      state.battingIndex = (current + 1) % lineupSize;
    } else if (spotOf.size > 0 && pa.lineupSpot !== null && lineupSize > 0) {
      // They have left the game, so their spot belongs to whoever took it.
      state.battingIndex = (pa.lineupSpot - 1) % lineupSize;
    } else if (pa.lineupSpot !== null && lineupSize > 0) {
      state.battingIndex = pa.lineupSpot % lineupSize;
    } else if (lineupSize > 0) {
      state.battingIndex = (state.battingIndex + 1) % lineupSize;
    }

    // Three outs ends our half; the next appearance belongs to the next inning.
    if (state.outs >= 3) {
      state.inning += 1;
      state.outs = 0;
      state.bases = [null, null, null];
    }
  }

  // A correction made after the last recorded play still applies.
  applyOverride();

  state.half = weBat;
  state.isOurHalf = true;
  state.complete = state.inning > scheduledInnings;

  return state;
}

/**
 * Default runner advancement for an outcome.
 *
 * Chosen to be right in the common case so a scorekeeper can record a play with
 * one tap. Anything unusual is adjusted afterwards, and the correction flows
 * through to every derived statistic.
 */
export function defaultAdvancement(
  result: ResultType,
  bases: [string | null, string | null, string | null],
  batterId: string,
): RunnerMovement[] {
  const movements: RunnerMovement[] = [];
  const [first, second, third] = bases;

  // An RBI is credited when the run is driven in - not when it scores on an
  // error or a fielder's choice.
  const drivesInRuns = result.isHit || result.isSacFly || result.isWalk || result.isHbp;

  const advanceBy = (n: number) => {
    const push = (runnerId: string | null, from: Base) => {
      if (!runnerId) return;
      const to = Math.min(from + n, 4) as Base;
      movements.push({
        runnerId,
        startBase: from,
        endBase: to,
        isOut: false,
        rbiCredited: to === 4 && drivesInRuns,
      });
    };
    push(third, 3);
    push(second, 2);
    push(first, 1);
  };

  if (result.isHit) {
    const bases_ = result.totalBases;

    if (bases_ === 4) {
      // Home run: everybody scores, batter included.
      advanceBy(4);
      movements.push({
        runnerId: batterId, startBase: 0, endBase: 4, isOut: false, rbiCredited: true,
      });
      return movements;
    }

    advanceBy(bases_);
    movements.push({
      runnerId: batterId,
      startBase: 0,
      endBase: bases_ as Base,
      isOut: false,
      rbiCredited: false,
    });
    return movements;
  }

  if (result.isWalk || result.isHbp) {
    // Only forced runners move.
    const forcedThird = Boolean(first && second && third);
    const forcedSecond = Boolean(first && second);

    if (forcedThird && third) {
      movements.push({ runnerId: third, startBase: 3, endBase: 4, isOut: false, rbiCredited: true });
    }
    if (forcedSecond && second) {
      movements.push({ runnerId: second, startBase: 2, endBase: 3, isOut: false, rbiCredited: false });
    }
    if (first) {
      movements.push({ runnerId: first, startBase: 1, endBase: 2, isOut: false, rbiCredited: false });
    }
    movements.push({ runnerId: batterId, startBase: 0, endBase: 1, isOut: false, rbiCredited: false });
    return movements;
  }

  if (result.isError || result.isFieldersChoice) {
    // Batter is safe; runners move up a base, but nothing is driven in.
    advanceBy(1);
    movements.push({ runnerId: batterId, startBase: 0, endBase: 1, isOut: false, rbiCredited: false });

    if (result.isFieldersChoice) {
      // The lead forced runner is retired instead of advancing.
      const lead = movements.find((m) => m.startBase >= 1 && !m.isOut);
      if (lead) {
        lead.isOut = true;
        lead.endBase = null;
        lead.rbiCredited = false;
      }
    }
    return movements;
  }

  if (result.isSacFly) {
    // Runner on third scores, batter is out.
    if (third) {
      movements.push({ runnerId: third, startBase: 3, endBase: 4, isOut: false, rbiCredited: true });
    }
    movements.push({ runnerId: batterId, startBase: 0, endBase: null, isOut: true, rbiCredited: false });
    return movements;
  }

  if (result.isSacBunt) {
    advanceBy(1);
    for (const m of movements) m.rbiCredited = false;
    movements.push({ runnerId: batterId, startBase: 0, endBase: null, isOut: true, rbiCredited: false });
    return movements;
  }

  // Any other out: the batter is retired and runners hold.
  movements.push({ runnerId: batterId, startBase: 0, endBase: null, isOut: true, rbiCredited: false });

  if (result.code === 'DP') {
    const lead = first ? 1 : second ? 2 : third ? 3 : null;
    if (lead) {
      const runnerId = bases[lead - 1];
      movements.push({
        runnerId, startBase: lead as Base, endBase: null, isOut: true, rbiCredited: false,
      });
    }
  }

  return movements;
}

/** Outs recorded by a set of movements, used to keep the log self-consistent. */
export function outsFromMovements(movements: RunnerMovement[]): number {
  return movements.filter((m) => m.isOut).length;
}

/** Runs scored by a set of movements. */
export function runsFromMovements(movements: RunnerMovement[]): number {
  return movements.filter((m) => !m.isOut && m.endBase === 4).length;
}

/** RBIs credited by a set of movements. */
export function rbisFromMovements(movements: RunnerMovement[]): number {
  return movements.filter((m) => m.rbiCredited).length;
}
