'use client';

import { useCallback, useMemo, useOptimistic, useRef, useState, useTransition } from 'react';
import { ListOrdered, Pencil, Undo2 } from 'lucide-react';
import {
  InteractiveDiamond,
  type BaseNumber,
  type Destination,
} from '@/components/sports/InteractiveDiamond';
import { JerseyNumber } from '@/components/sports/JerseyNumber';
import {
  finalizeGame, moveRunner, recordPlay, setOpponentRuns, undoLastPlay,
} from '@/lib/actions/scoring';
import { ScoreEditor, type InningRow } from './ScoreEditor';
import { LineupSheet } from './LineupSheet';
import type { RosterPlayer } from '@/lib/queries/players';
import {
  defaultAdvancement, outsFromMovements, replayGame,
  type PlateAppearanceRecord, type ResultType,
} from '@/lib/scoring/engine';
import { formatInning, formatOuts } from '@/lib/format';
import { cn } from '@/lib/cn';
import type { LineupEntry } from '@/lib/queries/scoring';

/**
 * The live scorebook.
 *
 * Built for one thumb on a phone at the field: the scoreboard is always
 * visible, the outcome keys are large touch targets, and the common case is a
 * single tap. Game state is replayed from the play log on every render, so what
 * is on screen is always what is in the database.
 */

interface ResultButton {
  code: string;
  label: string;
  short_label: string;
  counts_as_ab: boolean;
  is_hit: boolean;
  total_bases: number;
  is_walk: boolean;
  is_hbp: boolean;
  is_strikeout: boolean;
  is_sac_fly: boolean;
  is_sac_bunt: boolean;
  is_error: boolean;
  is_fielders_choice: boolean;
  batter_reaches: boolean;
  default_outs: number;
}

/** Row shape -> the engine's shape, so client and server agree exactly. */
function toResultType(r: ResultButton): ResultType {
  return {
    code: r.code,
    label: r.label,
    shortLabel: r.short_label,
    countsAsAb: r.counts_as_ab,
    isHit: r.is_hit,
    totalBases: r.total_bases,
    isWalk: r.is_walk,
    isHbp: r.is_hbp,
    isStrikeout: r.is_strikeout,
    isSacFly: r.is_sac_fly,
    isSacBunt: r.is_sac_bunt,
    isError: r.is_error,
    isFieldersChoice: r.is_fielders_choice,
    batterReaches: r.batter_reaches,
    defaultOuts: r.default_outs,
  };
}

/** Keypad layout: the plays that actually happen, in reachable order. */
const PRIMARY = ['1B', '2B', '3B', 'HR'];
const SECONDARY = ['BB', 'HBP', 'ROE', 'FC'];
const OUTS = ['GO', 'FO', 'K', 'SF'];

export function Scorebook({
  gameId,
  opponentName,
  homeAway,
  scheduledInnings,
  lineup,
  plateAppearances,
  inningRuns,
  innings,
  resultTypes,
  roster,
  positions,
}: {
  gameId: string;
  opponentName: string | null;
  homeAway: 'home' | 'away';
  scheduledInnings: number;
  lineup: LineupEntry[];
  plateAppearances: PlateAppearanceRecord[];
  inningRuns: { inning: number; theirRuns: number }[];
  innings: InningRow[];
  resultTypes: ResultButton[];
  roster: RosterPlayer[];
  positions: { code: string; label: string }[];
}) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [editingScore, setEditingScore] = useState(false);
  const [editingLineup, setEditingLineup] = useState(false);

  /**
   * Optimistic play log.
   *
   * A scorekeeper taps faster than a round trip completes, so plays are applied
   * locally the instant they are tapped and reconciled when the server
   * re-renders. Nothing is ever dropped because a write is in flight.
   */
  const [optimisticPAs, applyOptimistic] = useOptimistic(
    plateAppearances,
    (current: PlateAppearanceRecord[], action: PlateAppearanceRecord | 'undo') =>
      action === 'undo' ? current.slice(0, -1) : [...current, action],
  );

  // Writes are serialised: recordPlay derives its sequence number from the
  // current maximum, so overlapping calls would collide on (game_id, sequence).
  const queue = useRef<Promise<unknown>>(Promise.resolve());

  const lineupPlayerIds = useMemo(() => lineup.map((l) => l.playerId), [lineup]);

  const state = useMemo(
    () =>
      replayGame({
        plateAppearances: optimisticPAs,
        inningRuns,
        lineupSize: lineup.length,
        lineupPlayerIds,
        homeAway,
        scheduledInnings,
      }),
    [optimisticPAs, inningRuns, lineup.length, lineupPlayerIds, homeAway, scheduledInnings],
  );

  const batter = lineup[state.battingIndex] ?? null;
  const onDeck = lineup[(state.battingIndex + 1) % Math.max(lineup.length, 1)] ?? null;

  const byCode = useMemo(
    () => new Map(resultTypes.map((r) => [r.code, r])),
    [resultTypes],
  );

  const play = useCallback(
    (code: string) => {
      if (!batter) return;
      const row = byCode.get(code);
      if (!row) return;

      setMessage(null);

      // Compute the movements here rather than letting the server decide, so
      // the optimistic state and the stored state are identical.
      const result = toResultType(row);
      const movements = defaultAdvancement(result, state.bases, batter.playerId);

      const optimisticPlay: PlateAppearanceRecord = {
        id: `optimistic-${state.inning}-${optimisticPAs.length + 1}`,
        sequence: (optimisticPAs[optimisticPAs.length - 1]?.sequence ?? 0) + 1,
        inning: state.inning,
        half: state.half,
        batterId: batter.playerId,
        lineupSpot: batter.battingOrder,
        resultCode: code,
        outsBefore: state.outs,
        outsOnPlay: outsFromMovements(movements),
        movements,
      };

      const payload = {
        gameId,
        batterId: batter.playerId,
        lineupSpot: batter.battingOrder,
        inning: state.inning,
        half: state.half,
        outsBefore: state.outs,
        resultCode: code,
        bases: state.bases,
        movements,
      };

      startTransition(async () => {
        applyOptimistic(optimisticPlay);
        const run = queue.current.then(() => recordPlay(payload));
        queue.current = run.catch(() => undefined);
        const outcome = await run;
        if (outcome.error) setMessage(outcome.error);
      });
    },
    [batter, byCode, state, gameId, optimisticPAs, applyOptimistic],
  );

  const undo = () => {
    if (optimisticPAs.length === 0) return;
    startTransition(async () => {
      applyOptimistic('undo');
      const run = queue.current.then(() => undoLastPlay(gameId));
      queue.current = run.catch(() => undefined);
      const outcome = await run;
      setMessage(outcome.error ?? outcome.success ?? null);
    });
  };

  const runnerMoved = (from: BaseNumber, to: Destination) => {
    startTransition(async () => {
      const result = await moveRunner(gameId, from, to);
      setMessage(result.error ?? result.success ?? null);
    });
  };

  const bumpOpponent = (delta: number) => {
    startTransition(async () => {
      const current = inningRuns.find((i) => i.inning === state.inning)?.theirRuns ?? 0;
      const result = await setOpponentRuns(gameId, state.inning, Math.max(0, current + delta));
      setMessage(result.error ?? null);
    });
  };

  const finish = () => {
    startTransition(async () => {
      const result = await finalizeGame(gameId);
      setMessage(result.error ?? result.success ?? null);
    });
  };

  const lastPlay = optimisticPAs[optimisticPAs.length - 1] ?? null;

  const battedPlayerIds = useMemo(
    () =>
      new Set(
        plateAppearances
          .map((pa) => pa.batterId)
          .filter((id): id is string => id !== null),
      ),
    [plateAppearances],
  );

  return (
    <div className="mx-auto flex min-h-screen max-w-2xl flex-col bg-ink-950">
      {/* -- scoreboard: always visible ---------------------------------- */}
      <header className="sticky top-0 z-30 bg-navy-950 shadow-[0_1px_0_rgba(255,255,255,0.1)]">
        <button
          type="button"
          onClick={() => setEditingScore(true)}
          aria-label="Edit the score"
          className="grid w-full grid-cols-[1fr_auto_1fr] items-center gap-2 px-4 py-3 text-left transition-colors active:bg-navy-900"
        >
          <TeamScore name="Moby Dicks" runs={state.ourRuns} leading={state.ourRuns > state.theirRuns} />

          <div className="px-2 text-center">
            <p className="type-eyebrow text-gold-400">
              {formatInning(state.half, state.inning)}
            </p>
            <p className="type-eyebrow mt-1 text-[10px] text-steel-400">
              {formatOuts(state.outs)}
            </p>
            <Pencil size={11} className="mx-auto mt-1.5 text-steel-600" aria-hidden />
          </div>

          <TeamScore
            name={opponentName ?? 'Opponent'}
            runs={state.theirRuns}
            leading={state.theirRuns > state.ourRuns}
            align="right"
          />
        </button>
      </header>

      {/* -- base state + batter ------------------------------------------ */}
      <section className="flex items-center justify-between gap-5 border-b border-white/10 px-4 py-5">
        <div className="min-w-0 flex-1">
          <p className="type-eyebrow mb-2 text-steel-500">At bat</p>
          {batter ? (
            <div className="flex items-center gap-3">
              <JerseyNumber value={batter.jerseyNumber} size="lg" tone="gold" />
              <div className="min-w-0">
                <p className="type-section text-lg leading-tight text-white">
                  {batter.displayName}
                </p>
                <p className="text-xs text-steel-500">
                  {batter.position ?? ''} · Spot {batter.battingOrder}
                </p>
              </div>
            </div>
          ) : (
            <p className="text-sm text-steel-500">No lineup set.</p>
          )}
          <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5">
            {onDeck && (
              <p className="type-eyebrow text-[10px] leading-tight text-steel-600">
                On deck: {onDeck.displayName}
              </p>
            )}
            <button
              type="button"
              onClick={() => setEditingLineup(true)}
              className="type-eyebrow inline-flex items-center gap-1.5 text-[10px] text-steel-500 underline underline-offset-2 active:text-white"
            >
              <ListOrdered size={12} aria-hidden />
              Lineup ({lineup.length})
            </button>
          </div>
        </div>

        <InteractiveDiamond
          first={state.bases[0]}
          second={state.bases[1]}
          third={state.bases[2]}
          onMove={runnerMoved}
          disabled={pending}
          className="shrink-0"
        />
      </section>

      {/* -- outcome keypad ------------------------------------------------ */}
      <div className="flex-1 px-3 py-4">
        <KeyRow codes={PRIMARY} byCode={byCode} onPlay={play} disabled={!batter} tone="hit" />
        <KeyRow codes={SECONDARY} byCode={byCode} onPlay={play} disabled={!batter} tone="reach" />
        <KeyRow codes={OUTS} byCode={byCode} onPlay={play} disabled={!batter} tone="out" />

        <button
          type="button"
          onClick={() => setShowAll((v) => !v)}
          className="type-eyebrow mt-1 w-full py-3 text-steel-500"
          aria-expanded={showAll}
        >
          {showAll ? 'Fewer outcomes' : 'More outcomes'}
        </button>

        {showAll && (
          <KeyRow
            codes={resultTypes
              .map((r) => r.code)
              .filter((c) => ![...PRIMARY, ...SECONDARY, ...OUTS].includes(c))}
            byCode={byCode}
            onPlay={play}
            disabled={!batter}
            tone="muted"
          />
        )}

        {/* -- opponent runs ---------------------------------------------- */}
        <div className="mt-5 flex items-center justify-between gap-3 border border-white/10 px-4 py-3">
          <div>
            <p className="type-eyebrow text-steel-400">
              {opponentName ?? 'Opponent'} · inning {state.inning}
            </p>
            <p className="mt-1 text-xs text-steel-600">Runs this inning</p>
          </div>
          <div className="flex items-center gap-2">
            <Stepper label="Remove a run" onClick={() => bumpOpponent(-1)} disabled={pending}>−</Stepper>
            <span className="num-stat w-10 text-center text-white">
              {inningRuns.find((i) => i.inning === state.inning)?.theirRuns ?? 0}
            </span>
            <Stepper label="Add a run" onClick={() => bumpOpponent(1)} disabled={pending}>+</Stepper>
          </div>
        </div>

        {message && (
          <p role="status" className="mt-4 text-center text-sm text-steel-400">
            {message}
          </p>
        )}
      </div>

      {/* -- action bar ---------------------------------------------------- */}
      <footer className="sticky bottom-0 z-30 flex items-stretch gap-px border-t border-white/10 bg-ink-900">
        <button
          type="button"
          onClick={undo}
          disabled={optimisticPAs.length === 0}
          className="flex min-h-14 flex-1 items-center justify-center gap-2 text-steel-300 disabled:opacity-40"
        >
          <Undo2 size={18} />
          <span className="type-eyebrow">
            Undo{lastPlay ? ` ${lastPlay.resultCode}` : ''}
          </span>
        </button>

        <button
          type="button"
          onClick={finish}
          disabled={pending}
          className="type-eyebrow min-h-14 flex-1 bg-gold-400 text-navy-950 disabled:opacity-50"
        >
          Final
        </button>
      </footer>

      {editingLineup && (
        <LineupSheet
          gameId={gameId}
          currentInning={state.inning}
          existing={lineup}
          roster={roster}
          positions={positions}
          battedPlayerIds={battedPlayerIds}
          onClose={() => setEditingLineup(false)}
        />
      )}

      {editingScore && (
        <ScoreEditor
          gameId={gameId}
          innings={innings}
          currentInning={state.inning}
          opponentName={opponentName}
          onClose={() => setEditingScore(false)}
        />
      )}
    </div>
  );
}

function TeamScore({
  name, runs, leading, align = 'left',
}: {
  name: string; runs: number; leading: boolean; align?: 'left' | 'right';
}) {
  return (
    <div className={align === 'right' ? 'text-right' : ''}>
      <p className={cn('type-eyebrow truncate text-[10px]', leading ? 'text-white' : 'text-steel-500')}>
        {name}
      </p>
      <p
        className={cn(
          'num-base text-4xl font-extrabold tabular-nums',
          leading ? 'text-white' : 'text-steel-300',
        )}
        style={{ fontStretch: '75%' }}
      >
        {runs}
      </p>
    </div>
  );
}

const TONES = {
  hit: 'bg-navy-700 text-white active:bg-navy-600',
  reach: 'bg-ink-800 text-steel-100 active:bg-ink-700',
  out: 'bg-ink-900 text-steel-300 active:bg-ink-800',
  muted: 'bg-ink-900 text-steel-400 active:bg-ink-800',
} as const;

function KeyRow({
  codes, byCode, onPlay, disabled, tone,
}: {
  codes: string[];
  byCode: Map<string, ResultButton>;
  onPlay: (code: string) => void;
  disabled: boolean;
  tone: keyof typeof TONES;
}) {
  const present = codes.filter((c) => byCode.has(c));
  if (present.length === 0) return null;

  return (
    <div className="mb-2 grid grid-cols-4 gap-2">
      {present.map((code) => {
        const r = byCode.get(code)!;
        return (
          <button
            key={code}
            type="button"
            onClick={() => onPlay(code)}
            disabled={disabled}
            aria-label={r.label}
            className={cn(
              // 72px primary targets: usable with one thumb, in the dark.
              'flex min-h-[4.5rem] flex-col items-center justify-center gap-1 ring-1 ring-inset ring-white/10 transition-colors disabled:opacity-40',
              TONES[tone],
            )}
          >
            <span className="num-base text-xl font-extrabold" style={{ fontStretch: '80%' }}>
              {r.short_label}
            </span>
            <span className="type-eyebrow text-[9px] opacity-60">{r.label}</span>
          </button>
        );
      })}
    </div>
  );
}

function Stepper({
  children, onClick, disabled, label,
}: {
  children: React.ReactNode; onClick: () => void; disabled: boolean; label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className="inline-flex h-12 w-12 items-center justify-center bg-ink-800 text-xl text-white ring-1 ring-inset ring-white/10 active:bg-ink-700 disabled:opacity-40"
    >
      {children}
    </button>
  );
}
