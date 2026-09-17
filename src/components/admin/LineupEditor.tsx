'use client';

import { ArrowDown, ArrowUp, X } from 'lucide-react';
import { JerseyNumber } from '@/components/sports/JerseyNumber';
import { cn } from '@/lib/cn';
import type { LineupEntry } from '@/lib/queries/scoring';
import type { RosterPlayer } from '@/lib/queries/players';

/**
 * Batting order and defensive positions.
 *
 * Shared by pregame setup and the in-game lineup sheet so there is one
 * implementation of the ordering rules rather than two that drift.
 *
 * Reordering is by explicit up/down buttons rather than drag and drop: this is
 * used one-handed, outdoors, on a phone, where drag targets are unreliable -
 * and drag is inaccessible to keyboard and screen reader users anyway.
 */

export interface LineupEditorProps {
  order: LineupEntry[];
  onChange: (order: LineupEntry[]) => void;
  roster: RosterPlayer[];
  positions: { code: string; label: string }[];
  /** Players who have already batted; they keep their stats if removed. */
  battedPlayerIds?: Set<string>;
  disabled?: boolean;
}

/** Renumbers the batting order so spots stay 1..n with no gaps. */
const renumber = (entries: LineupEntry[]): LineupEntry[] =>
  entries.map((entry, i) => ({ ...entry, battingOrder: i + 1 }));

export function LineupEditor({
  order,
  onChange,
  roster,
  positions,
  battedPlayerIds,
  disabled,
}: LineupEditorProps) {
  const inLineup = new Set(order.map((o) => o.playerId));
  const available = roster.filter((p) => !inLineup.has(p.id));

  const add = (player: RosterPlayer) =>
    onChange(
      renumber([
        ...order,
        {
          playerId: player.id,
          displayName: player.displayName,
          jerseyNumber: player.jerseyNumber,
          battingOrder: order.length + 1,
          position: player.position,
        },
      ]),
    );

  const remove = (playerId: string) =>
    onChange(renumber(order.filter((o) => o.playerId !== playerId)));

  const move = (index: number, delta: number) => {
    const next = [...order];
    const target = index + delta;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    onChange(renumber(next));
  };

  const setPosition = (playerId: string, position: string) =>
    onChange(
      order.map((o) =>
        o.playerId === playerId ? { ...o, position: position || null } : o,
      ),
    );

  return (
    <>
      <section className="mb-8">
        <h3 className="type-eyebrow mb-3 text-steel-400">
          Batting order ({order.length})
        </h3>

        {order.length === 0 ? (
          <p className="bg-ink-900 px-4 py-6 text-sm text-steel-500">
            Add players from the roster below.
          </p>
        ) : (
          <ol className="flex flex-col gap-px bg-white/5">
            {order.map((entry, i) => {
              const hasBatted = battedPlayerIds?.has(entry.playerId) ?? false;

              return (
                <li key={entry.playerId} className="bg-ink-900 px-3 py-2">
                  {/* Name gets the full width of the row; the controls sit beneath
                      it, because a phone cannot fit both and still read. */}
                  <div className="flex items-center gap-3">
                    <span className="num-table w-6 shrink-0 text-center text-steel-500">
                      {i + 1}
                    </span>
                    <JerseyNumber
                      value={entry.jerseyNumber}
                      size="sm"
                      tone="ghost"
                    />
                    <span className="min-w-0 flex-1 truncate text-sm text-white">
                      {entry.displayName}
                    </span>

                    <div className="flex shrink-0">
                      <IconButton
                        label={`Move ${entry.displayName} up`}
                        onClick={() => move(i, -1)}
                        disabled={disabled || i === 0}
                      >
                        <ArrowUp size={16} />
                      </IconButton>
                      <IconButton
                        label={`Move ${entry.displayName} down`}
                        onClick={() => move(i, 1)}
                        disabled={disabled || i === order.length - 1}
                      >
                        <ArrowDown size={16} />
                      </IconButton>
                      <IconButton
                        label={`Remove ${entry.displayName}`}
                        onClick={() => remove(entry.playerId)}
                        disabled={disabled}
                      >
                        <X size={16} />
                      </IconButton>
                    </div>
                  </div>

                  <div className="mt-1 flex items-center gap-2 pl-9">
                    <select
                      value={entry.position ?? ''}
                      onChange={(e) =>
                        setPosition(entry.playerId, e.target.value)
                      }
                      disabled={disabled}
                      aria-label={`Position for ${entry.displayName}`}
                      className="w-16 shrink-0 bg-ink-800 px-2 py-1 text-xs text-white ring-1 ring-inset ring-white/10"
                    >
                      <option value="">—</option>
                      {positions.map((p) => (
                        <option key={p.code} value={p.code}>
                          {p.code}
                        </option>
                      ))}
                    </select>
                    {hasBatted && (
                      <span className="type-eyebrow whitespace-nowrap text-[9px] text-steel-600">
                        Has batted
                      </span>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </section>

      {available.length > 0 && (
        <section className="mb-8">
          <h3 className="type-eyebrow mb-3 text-steel-400">Available</h3>
          <div className="flex flex-wrap gap-2">
            {available.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => add(p)}
                disabled={disabled}
                className={cn(
                  'flex min-h-11 items-center gap-2 bg-ink-900 px-3 py-2 text-sm text-steel-200',
                  'ring-1 ring-inset ring-white/10 active:bg-ink-800 disabled:opacity-40',
                )}
              >
                <JerseyNumber value={p.jerseyNumber} size="sm" tone="ghost" />
                {p.displayName}
              </button>
            ))}
          </div>
        </section>
      )}
    </>
  );
}

function IconButton({
  children,
  onClick,
  disabled,
  label,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className="inline-flex h-11 w-9 items-center justify-center text-steel-500 active:text-white disabled:opacity-30"
    >
      {children}
    </button>
  );
}
