'use client';

import { useState } from 'react';
import { cn } from '@/lib/cn';
import { describeBases, ordinal } from '@/lib/format';

/**
 * The base diamond, made tappable.
 *
 * Tap the base a runner is standing on, then tap the base they actually
 * reached. That covers the judgements automatic advancement cannot make - going
 * first-to-third on a single, scoring from first on a double, or being thrown
 * out trying it.
 *
 * Bases are real buttons rather than SVG shapes with handlers, so they are
 * keyboard reachable, announce what they do, and give a 44px target on a phone.
 */

export type BaseNumber = 1 | 2 | 3;
export type Destination = 1 | 2 | 3 | 4 | 'out';

const LABELS: Record<BaseNumber, string> = { 1: 'First', 2: 'Second', 3: 'Third' };

/** Position of each base within the 100x100 square, as percentages. */
const POSITIONS: Record<BaseNumber | 'home', { x: number; y: number }> = {
  1: { x: 82, y: 50 },
  2: { x: 50, y: 18 },
  3: { x: 18, y: 50 },
  home: { x: 50, y: 82 },
};

export function InteractiveDiamond({
  first,
  second,
  third,
  onMove,
  disabled,
  className,
}: {
  first: string | null;
  second: string | null;
  third: string | null;
  onMove: (from: BaseNumber, to: Destination) => void;
  disabled?: boolean;
  className?: string;
}) {
  const [selected, setSelected] = useState<BaseNumber | null>(null);

  const occupancy: Record<BaseNumber, string | null> = { 1: first, 2: second, 3: third };
  const occupied: [boolean, boolean, boolean] = [
    Boolean(first),
    Boolean(second),
    Boolean(third),
  ];

  const choose = (base: BaseNumber) => {
    if (disabled) return;
    if (selected === base) {
      setSelected(null);
      return;
    }
    if (selected !== null && base > selected) {
      onMove(selected, base);
      setSelected(null);
      return;
    }
    if (occupancy[base]) setSelected(base);
  };

  const sendTo = (destination: Destination) => {
    if (selected === null) return;
    onMove(selected, destination);
    setSelected(null);
  };

  return (
    <div className={cn('flex flex-col items-center gap-3', className)}>
      <div className="relative h-[124px] w-[124px]" role="group" aria-label="Base runners">
        {/* base paths */}
        <svg viewBox="0 0 100 100" className="absolute inset-0 h-full w-full" aria-hidden>
          <polygon
            points="50,18 82,50 50,82 18,50"
            fill="none"
            stroke="currentColor"
            strokeWidth={1}
            className="text-white/10"
          />
        </svg>

        {(Object.keys(LABELS) as unknown as BaseNumber[]).map((n) => {
          const base = Number(n) as BaseNumber;
          const pos = POSITIONS[base];
          const isOccupied = Boolean(occupancy[base]);
          const isSelected = selected === base;
          const isTarget = selected !== null && base > selected;

          return (
            <button
              key={base}
              type="button"
              disabled={disabled || (!isOccupied && !isTarget)}
              onClick={() => choose(base)}
              aria-pressed={isSelected}
              aria-label={
                isTarget
                  ? `Move runner to ${LABELS[base].toLowerCase()}`
                  : isOccupied
                    ? `Runner on ${LABELS[base].toLowerCase()} — tap to move`
                    : `${LABELS[base]} base empty`
              }
              className="absolute flex h-11 w-11 -translate-x-1/2 -translate-y-1/2 items-center justify-center disabled:cursor-default"
              style={{ left: `${pos.x}%`, top: `${pos.y}%` }}
            >
              <span
                className={cn(
                  'block h-4 w-4 rotate-45 transition-all',
                  isSelected && 'scale-125 bg-white ring-2 ring-white',
                  !isSelected && isOccupied && 'bg-gold-400',
                  !isSelected && !isOccupied && isTarget &&
                    'bg-transparent ring-2 ring-dashed ring-gold-400/70',
                  !isSelected && !isOccupied && !isTarget &&
                    'bg-transparent ring-1 ring-white/25',
                )}
              />
            </button>
          );
        })}

        {/* home plate doubles as the "scored" target */}
        <button
          type="button"
          disabled={disabled || selected === null}
          onClick={() => sendTo(4)}
          aria-label={selected ? 'Runner scored' : 'Home plate'}
          className="absolute flex h-11 w-11 -translate-x-1/2 -translate-y-1/2 items-center justify-center disabled:cursor-default"
          style={{ left: `${POSITIONS.home.x}%`, top: `${POSITIONS.home.y}%` }}
        >
          <span
            className={cn(
              'block h-4 w-4 transition-all',
              selected !== null
                ? 'scale-110 bg-win ring-2 ring-win/60'
                : 'bg-white/20',
            )}
            style={{ clipPath: 'polygon(0 0, 100% 0, 100% 60%, 50% 100%, 0 60%)' }}
          />
        </button>
      </div>

      {selected === null ? (
        <p className="type-eyebrow max-w-[124px] text-center text-[9px] leading-tight text-steel-500">
          {describeBases(occupied)}
          {occupied.some(Boolean) && (
            <span className="mt-1 block text-steel-600">Tap to move</span>
          )}
        </p>
      ) : (
        <div className="flex flex-col items-center gap-2">
          <p className="type-eyebrow max-w-[136px] text-center text-[9px] leading-tight text-gold-400">
            On {LABELS[selected].toLowerCase()} — tap where they went
          </p>
          <div className="flex gap-1.5">
            <Action onClick={() => sendTo(4)} tone="score">
              Scored
            </Action>
            <Action onClick={() => sendTo('out')} tone="out">
              Out
            </Action>
            <Action onClick={() => setSelected(null)} tone="cancel">
              Cancel
            </Action>
          </div>
        </div>
      )}

      <p className="sr-only" aria-live="polite">
        {selected === null
          ? describeBases(occupied)
          : `Runner on ${ordinal(selected)} selected. Choose a destination.`}
      </p>
    </div>
  );
}

function Action({
  children,
  onClick,
  tone,
}: {
  children: React.ReactNode;
  onClick: () => void;
  tone: 'score' | 'out' | 'cancel';
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'type-eyebrow min-h-9 px-2.5 py-1.5 text-[9px] ring-1 ring-inset transition-colors',
        tone === 'score' && 'bg-win/15 text-win ring-win/40',
        tone === 'out' && 'bg-loss/15 text-loss ring-loss/40',
        tone === 'cancel' && 'bg-white/5 text-steel-400 ring-white/15',
      )}
    >
      {children}
    </button>
  );
}
