import {
  defaultAdvancement, replayGame, outsFromMovements, runsFromMovements, rbisFromMovements,
  type ResultType, type RunnerMovement,
} from '../src/lib/scoring/engine';

const T = (over: Partial<ResultType> & { code: string }): ResultType => ({
  label: over.code, shortLabel: over.code, countsAsAb: true, isHit: false, totalBases: 0,
  isWalk: false, isHbp: false, isStrikeout: false, isSacFly: false, isSacBunt: false,
  isError: false, isFieldersChoice: false, batterReaches: false, defaultOuts: 0, ...over,
});

const R = {
  single: T({ code: '1B', isHit: true, totalBases: 1, batterReaches: true }),
  double: T({ code: '2B', isHit: true, totalBases: 2, batterReaches: true }),
  hr: T({ code: 'HR', isHit: true, totalBases: 4, batterReaches: true }),
  bb: T({ code: 'BB', isWalk: true, countsAsAb: false, batterReaches: true }),
  out: T({ code: 'GO', defaultOuts: 1 }),
  sf: T({ code: 'SF', isSacFly: true, countsAsAb: false, defaultOuts: 1 }),
  roe: T({ code: 'ROE', isError: true, batterReaches: true }),
  fc: T({ code: 'FC', isFieldersChoice: true, batterReaches: true }),
};

let pass = 0, fail = 0;
const check = (name: string, actual: unknown, expected: unknown) => {
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  if (a === e) { pass++; console.log(`  ok   ${name}`); }
  else { fail++; console.log(`  FAIL ${name}\n       got      ${a}\n       expected ${e}`); }
};

const summarize = (m: RunnerMovement[]) => ({
  outs: outsFromMovements(m), runs: runsFromMovements(m), rbi: rbisFromMovements(m),
});

console.log('\nAdvancement defaults:');
check('HR with bases loaded = 4 runs, 4 RBI',
  summarize(defaultAdvancement(R.hr, ['r1','r2','r3'], 'B')), { outs: 0, runs: 4, rbi: 4 });
check('Solo HR = 1 run, 1 RBI',
  summarize(defaultAdvancement(R.hr, [null,null,null], 'B')), { outs: 0, runs: 1, rbi: 1 });
check('Single scores runner from 3rd, 1 RBI',
  summarize(defaultAdvancement(R.single, [null,null,'r3'], 'B')), { outs: 0, runs: 1, rbi: 1 });
check('Single with empty bases = no runs',
  summarize(defaultAdvancement(R.single, [null,null,null], 'B')), { outs: 0, runs: 0, rbi: 0 });
check('Double scores from 2nd and 3rd',
  summarize(defaultAdvancement(R.double, [null,'r2','r3'], 'B')), { outs: 0, runs: 2, rbi: 2 });
check('Walk with bases loaded forces in a run',
  summarize(defaultAdvancement(R.bb, ['r1','r2','r3'], 'B')), { outs: 0, runs: 1, rbi: 1 });
check('Walk with runner on 2nd only: runner holds',
  summarize(defaultAdvancement(R.bb, [null,'r2',null], 'B')), { outs: 0, runs: 0, rbi: 0 });
check('Walk with runner on 2nd: bases after = 1st and 2nd',
  defaultAdvancement(R.bb, [null,'r2',null], 'B').map(m => [m.runnerId, m.endBase]),
  [['B', 1]]);
check('Groundout = 1 out, runners hold',
  summarize(defaultAdvancement(R.out, ['r1',null,null], 'B')), { outs: 1, runs: 0, rbi: 0 });
check('Sac fly scores from 3rd with RBI, batter out',
  summarize(defaultAdvancement(R.sf, [null,null,'r3'], 'B')), { outs: 1, runs: 1, rbi: 1 });
check('Reached on error: run scores but NO RBI',
  summarize(defaultAdvancement(R.roe, [null,null,'r3'], 'B')), { outs: 0, runs: 1, rbi: 0 });
check("Fielder's choice retires the lead runner, no RBI",
  summarize(defaultAdvancement(R.fc, ['r1',null,null], 'B')), { outs: 1, runs: 0, rbi: 0 });

console.log('\nGame replay:');
const pa = (seq: number, inning: number, spot: number, code: string, movements: RunnerMovement[]) => ({
  id: `pa${seq}`, sequence: seq, inning, half: 'bottom' as const, batterId: `p${spot}`,
  lineupSpot: spot, resultCode: code, outsBefore: 0,
  outsOnPlay: outsFromMovements(movements), movements,
});

// Inning 1: single, then a 2-run homer, then three outs.
const log = [
  pa(1, 1, 1, '1B', defaultAdvancement(R.single, [null,null,null], 'p1')),
  pa(2, 1, 2, 'HR', defaultAdvancement(R.hr, ['p1',null,null], 'p2')),
  pa(3, 1, 3, 'GO', defaultAdvancement(R.out, [null,null,null], 'p3')),
  pa(4, 1, 4, 'GO', defaultAdvancement(R.out, [null,null,null], 'p4')),
  pa(5, 1, 5, 'GO', defaultAdvancement(R.out, [null,null,null], 'p5')),
];
const s1 = replayGame({ plateAppearances: log, inningRuns: [{ inning: 1, theirRuns: 3 }], lineupSize: 9, homeAway: 'home', scheduledInnings: 7 });
check('after 3 outs: our runs = 2', s1.ourRuns, 2);
check('after 3 outs: their runs from linescore = 3', s1.theirRuns, 3);
check('after 3 outs: advanced to inning 2', s1.inning, 2);
check('after 3 outs: outs reset', s1.outs, 0);
check('after 3 outs: bases cleared', s1.bases, [null, null, null]);
check('batting order continues at spot 6', s1.battingIndex, 5);

// Mid-inning state.
const mid = replayGame({ plateAppearances: log.slice(0, 3), inningRuns: [], lineupSize: 9, homeAway: 'home', scheduledInnings: 7 });
check('mid-inning: 1 out', mid.outs, 1);
check('mid-inning: 2 runs in', mid.ourRuns, 2);
check('mid-inning: bases empty after HR', mid.bases, [null, null, null]);

// Lineup edited mid-game: who is due up follows the order as it stands now.
console.log('\nLineup changes mid-game:');
const nine = ['p1','p2','p3','p4','p5','p6','p7','p8','p9'];

check('unchanged order: still spot 6 due up',
  replayGame({ plateAppearances: log, inningRuns: [], lineupSize: 9, lineupPlayerIds: nine, homeAway: 'home', scheduledInnings: 7 }).battingIndex,
  5);

// A latecomer added to the bottom of the order does not disturb who is next.
check('player added at the end: spot 6 still due up',
  replayGame({ plateAppearances: log, inningRuns: [], lineupSize: 10, lineupPlayerIds: [...nine, 'p10'], homeAway: 'home', scheduledInnings: 7 }).battingIndex,
  5);

// Inserting ahead of the last batter pushes them down; the next spot follows.
check('player inserted at the top: due up shifts with the order',
  replayGame({ plateAppearances: log, inningRuns: [], lineupSize: 10, lineupPlayerIds: ['p10', ...nine], homeAway: 'home', scheduledInnings: 7 }).battingIndex,
  6);

// Dropping someone who already batted closes the gap behind them.
check('batter ahead of the last one removed: due up closes up',
  replayGame({ plateAppearances: log, inningRuns: [], lineupSize: 8, lineupPlayerIds: nine.filter((id) => id !== 'p1'), homeAway: 'home', scheduledInnings: 7 }).battingIndex,
  4);

// The last batter leaving the game leaves their spot to whoever now holds it.
check('last batter removed: whoever took their spot is due up',
  replayGame({ plateAppearances: log, inningRuns: [], lineupSize: 8, lineupPlayerIds: nine.filter((id) => id !== 'p5'), homeAway: 'home', scheduledInnings: 7 }).battingIndex,
  4);

// Wrapping still works once the order is shorter than the recorded spot.
const through9 = [...log, pa(6, 2, 6, '1B', []), pa(7, 2, 7, '1B', []), pa(8, 2, 8, '1B', []), pa(9, 2, 9, '1B', [])];
check('last spot in a shortened order wraps to the top',
  replayGame({ plateAppearances: through9, inningRuns: [], lineupSize: 8, lineupPlayerIds: nine.filter((id) => id !== 'p2'), homeAway: 'home', scheduledInnings: 7 }).battingIndex,
  0);

// Corrections to the inning and the outs made from the scoreboard.
console.log('\nInning and outs corrections:');
const base = { inningRuns: [], lineupSize: 9, homeAway: 'home' as const, scheduledInnings: 7 };

// log ends the 1st with 3 outs, so the replay sits at the 2nd, 0 out.
check('no override: replayed state stands',
  (({ inning, outs }) => ({ inning, outs }))(replayGame({ ...base, plateAppearances: log })),
  { inning: 2, outs: 0 });

const after5 = { afterSequence: 5, inning: null, outs: null };

check('outs alone: inning is left where the plays put it',
  (({ inning, outs }) => ({ inning, outs }))(
    replayGame({ ...base, plateAppearances: log, stateOverride: { ...after5, outs: 2 } })),
  { inning: 2, outs: 2 });

check('inning alone: the half starts fresh',
  (({ inning, outs }) => ({ inning, outs }))(
    replayGame({ ...base, plateAppearances: log, stateOverride: { ...after5, inning: 5 } })),
  { inning: 5, outs: 0 });

check('inning and outs together',
  (({ inning, outs }) => ({ inning, outs }))(
    replayGame({ ...base, plateAppearances: log, stateOverride: { ...after5, inning: 5, outs: 2 } })),
  { inning: 5, outs: 2 });

// Moving the inning on clears the bases: nobody is left on from the last one.
const runnerOn = [pa(1, 1, 1, '1B', defaultAdvancement(R.single, [null,null,null], 'p1'))];
check('runner on first, no correction',
  replayGame({ ...base, plateAppearances: runnerOn }).bases, ['p1', null, null]);
check('moving the inning on clears the bases',
  replayGame({ ...base, plateAppearances: runnerOn,
    stateOverride: { afterSequence: 1, inning: 2, outs: null } }).bases,
  [null, null, null]);
check('correcting only the outs leaves the runner on',
  replayGame({ ...base, plateAppearances: runnerOn,
    stateOverride: { afterSequence: 1, inning: null, outs: 2 } }).bases,
  ['p1', null, null]);

// A correction anchored mid-log leaves the plays after it in charge.
check('a play recorded after the correction carries on from it',
  (({ inning, outs }) => ({ inning, outs }))(
    replayGame({
      ...base,
      plateAppearances: [...runnerOn, pa(2, 4, 2, 'GO', defaultAdvancement(R.out, [null,null,null], 'p2'))],
      stateOverride: { afterSequence: 1, inning: 4, outs: 2 },
    })),
  { inning: 5, outs: 0 }); // 2 outs + the groundout retires the side

// Undoing back past the anchor must not resurrect the old inning.
check('correction survives undoing the play it was anchored to',
  (({ inning, outs }) => ({ inning, outs }))(
    replayGame({ ...base, plateAppearances: [], stateOverride: { afterSequence: 5, inning: 5, outs: 1 } })),
  { inning: 5, outs: 1 });

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail > 0 ? 1 : 0);
