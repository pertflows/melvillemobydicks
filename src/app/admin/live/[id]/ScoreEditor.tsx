'use client';

import { useState, useTransition } from 'react';
import { X } from 'lucide-react';
import { setGameState, setInningRuns } from '@/lib/actions/scoring';
import { cn } from '@/lib/cn';

/**
 * Scoreboard editor: where the inning, the outs and the linescore are corrected.
 *
 * Our runs are derived from the play log, so the honest way to "edit the score"
 * is to edit the inning it happened in. Changing one writes an override for
 * that inning, shown in gold, and "Use plays" clears it back to derived. The
 * opponent's runs are always entered, since their batters are not scored
 * individually.
 *
 * The inning and the outs are derived the same way and corrected the same way,
 * for the case the log cannot cover: an out nobody recorded, or a half-inning
 * that turned over while the phone was in a pocket.
 */

export interface InningRow {
  inning: number;
  ourRuns: number;
  theirRuns: number;
  /** Non-null when this inning's runs have been set by hand. */
  ourRunsOverride: number | null;
  derivedOurRuns: number;
}

export function ScoreEditor({
  gameId,
  innings,
  currentInning,
  currentHalf,
  currentOuts,
  inningOverridden,
  outsOverridden,
  opponentName,
  onClose,
}: {
  gameId: string;
  innings: InningRow[];
  currentInning: number;
  currentHalf: 'top' | 'bottom';
  currentOuts: number;
  /** Gold means hand-set: each of these is true only when that value was. */
  inningOverridden: boolean;
  outsOverridden: boolean;
  opponentName: string | null;
  onClose: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  // Always show at least through the current inning, even if nothing happened.
  const highest = Math.max(currentInning, ...innings.map((i) => i.inning), 1);
  const rows: InningRow[] = Array.from({ length: highest }, (_, idx) => {
    const inning = idx + 1;
    return (
      innings.find((i) => i.inning === inning) ?? {
        inning,
        ourRuns: 0,
        theirRuns: 0,
        ourRunsOverride: null,
        derivedOurRuns: 0,
      }
    );
  });

  const apply = (inning: number, values: { ourRuns?: number | null; theirRuns?: number }) =>
    startTransition(async () => {
      const result = await setInningRuns(gameId, inning, values);
      setMessage(result.error ?? null);
    });

  const setState = (values: { inning?: number; outs?: number } | null) =>
    startTransition(async () => {
      const result = await setGameState(gameId, values);
      setMessage(result.error ?? null);
    });

  const ourTotal = rows.reduce((sum, r) => sum + r.ourRuns, 0);
  const theirTotal = rows.reduce((sum, r) => sum + r.theirRuns, 0);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Edit the scoreboard"
      className="fixed inset-0 z-50 flex flex-col bg-ink-950/97 backdrop-blur-sm"
    >
      <header className="flex items-center justify-between border-b border-white/10 px-4 py-3">
        <h2 className="type-section text-sm text-white">Edit scoreboard</h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="-mr-2 inline-flex h-11 w-11 items-center justify-center text-steel-300"
        >
          <X size={22} />
        </button>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
        <section className="mb-7 border-b border-white/10 pb-6">
          <div className="mb-3 flex items-baseline justify-between">
            <h3 className="type-eyebrow text-steel-400">Where we are</h3>
            {(inningOverridden || outsOverridden) && (
              <button
                type="button"
                onClick={() => setState(null)}
                disabled={pending}
                className="type-eyebrow text-[9px] text-steel-500 underline underline-offset-2 hover:text-white"
              >
                Use plays
              </button>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col items-center gap-2 bg-ink-900 px-2 py-3">
              <span className="type-eyebrow text-[9px] text-steel-500">
                {currentHalf === 'top' ? 'Top of' : 'Bottom of'}
              </span>
              <Stepper
                value={currentInning}
                min={1}
                overridden={inningOverridden}
                disabled={pending}
                onChange={(v) => setState({ inning: v })}
                label="current inning"
              />
              <span className="type-eyebrow text-[9px] text-steel-600">Inning</span>
            </div>

            <div className="flex flex-col items-center gap-2 bg-ink-900 px-2 py-3">
              <span className="type-eyebrow text-[9px] text-steel-500">&nbsp;</span>
              <Stepper
                value={currentOuts}
                max={2}
                overridden={outsOverridden}
                disabled={pending}
                onChange={(v) => setState({ outs: v })}
                label="outs"
              />
              <span className="type-eyebrow text-[9px] text-steel-600">
                {currentOuts === 1 ? 'Out' : 'Outs'}
              </span>
            </div>
          </div>

          <p className="mt-4 border-l-[3px] border-steel-700 pl-4 text-xs leading-relaxed text-steel-500">
            Both normally come from the plays you record — set them here when a play
            went unrecorded. Outs run 0 to 2; moving the inning on retires the side
            and clears the bases. Scoring carries on from whatever you set.
          </p>
        </section>

        <h3 className="type-eyebrow mb-3 text-steel-400">Runs by inning</h3>

        <div className="mb-4 grid grid-cols-[3rem_1fr_1fr] items-center gap-2">
          <span className="type-eyebrow text-[9px] text-steel-600">Inn</span>
          <span className="type-eyebrow text-[9px] text-steel-400">Moby Dicks</span>
          <span className="type-eyebrow truncate text-[9px] text-steel-400">
            {opponentName ?? 'Opponent'}
          </span>
        </div>

        <div className="flex flex-col gap-2">
          {rows.map((row) => (
            <div key={row.inning} className="grid grid-cols-[3rem_1fr_1fr] items-center gap-2">
              <span
                className={cn(
                  'num-table text-center',
                  row.inning === currentInning ? 'text-gold-400' : 'text-steel-500',
                )}
              >
                {row.inning}
              </span>

              <Stepper
                value={row.ourRuns}
                overridden={row.ourRunsOverride !== null}
                disabled={pending}
                onChange={(v) => apply(row.inning, { ourRuns: v })}
                onReset={
                  row.ourRunsOverride !== null
                    ? () => apply(row.inning, { ourRuns: null })
                    : undefined
                }
                label={`Moby Dicks runs in inning ${row.inning}`}
              />

              <Stepper
                value={row.theirRuns}
                disabled={pending}
                onChange={(v) => apply(row.inning, { theirRuns: v })}
                label={`${opponentName ?? 'Opponent'} runs in inning ${row.inning}`}
              />
            </div>
          ))}
        </div>

        <div className="mt-5 grid grid-cols-[3rem_1fr_1fr] items-center gap-2 border-t border-white/10 pt-4">
          <span className="type-eyebrow text-center text-[9px] text-steel-500">R</span>
          <span className="num-stat text-center text-white">{ourTotal}</span>
          <span className="num-stat text-center text-white">{theirTotal}</span>
        </div>

        <p className="mt-6 border-l-[3px] border-steel-700 pl-4 text-xs leading-relaxed text-steel-500">
          Our runs come from the plays you record. Changing one here overrides that
          inning and shows in gold; <span className="text-steel-300">Use plays</span>{' '}
          puts it back. To fix how a run actually scored, move the runner on the
          diamond instead — that keeps the batting stats right too.
        </p>

        {message && (
          <p role="alert" className="mt-4 border-l-[3px] border-loss bg-loss/10 px-3 py-2 text-sm text-white">
            {message}
          </p>
        )}
      </div>

      <footer className="border-t border-white/10 p-4">
        <button
          type="button"
          onClick={onClose}
          className="type-eyebrow min-h-12 w-full bg-gold-400 text-navy-950"
        >
          Done
        </button>
      </footer>
    </div>
  );
}

function Stepper({
  value,
  onChange,
  onReset,
  overridden,
  disabled,
  label,
  min = 0,
  max,
}: {
  value: number;
  onChange: (value: number) => void;
  onReset?: () => void;
  overridden?: boolean;
  disabled: boolean;
  label: string;
  min?: number;
  max?: number;
}) {
  return (
    <div className="flex flex-col items-center gap-1">
      <div className="flex items-center gap-1">
        <button
          type="button"
          disabled={disabled || value <= min}
          onClick={() => onChange(value - 1)}
          aria-label={`Decrease ${label}`}
          className="inline-flex h-11 w-11 items-center justify-center bg-ink-800 text-lg text-white ring-1 ring-inset ring-white/10 disabled:opacity-40"
        >
          −
        </button>
        <span
          className={cn(
            'num-stat w-9 text-center',
            overridden ? 'text-gold-400' : 'text-white',
          )}
        >
          {value}
        </span>
        <button
          type="button"
          disabled={disabled || (max !== undefined && value >= max)}
          onClick={() => onChange(value + 1)}
          aria-label={`Increase ${label}`}
          className="inline-flex h-11 w-11 items-center justify-center bg-ink-800 text-lg text-white ring-1 ring-inset ring-white/10 disabled:opacity-40"
        >
          +
        </button>
      </div>
      {onReset && (
        <button
          type="button"
          onClick={onReset}
          disabled={disabled}
          className="type-eyebrow text-[9px] text-steel-500 underline underline-offset-2 hover:text-white"
        >
          Use plays
        </button>
      )}
    </div>
  );
}
