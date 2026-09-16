'use client';

import { useState, useTransition } from 'react';
import { ArrowDown, ArrowUp, X } from 'lucide-react';
import { JerseyNumber } from '@/components/sports/JerseyNumber';
import { AdminButton } from '@/components/admin/AdminPage';
import { copyLineupFrom, saveLineup, startGame } from '@/lib/actions/scoring';
import type { LineupEntry } from '@/lib/queries/scoring';
import type { RosterPlayer } from '@/lib/queries/players';

/**
 * Pregame setup: batting order and defensive positions.
 *
 * Reordering is by explicit up/down buttons rather than drag and drop, because
 * this is used one-handed, outdoors, on a phone - drag targets are unreliable
 * there and inaccessible to keyboard and screen reader users.
 */
export function Pregame({
  gameId,
  roster,
  positions,
  existing,
  siblingGame,
}: {
  gameId: string;
  roster: RosterPlayer[];
  positions: { code: string; label: string }[];
  existing: LineupEntry[];
  siblingGame: { id: string; gameNumber: number } | null;
}) {
  const [order, setOrder] = useState<LineupEntry[]>(existing);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const inLineup = new Set(order.map((o) => o.playerId));
  const available = roster.filter((p) => !inLineup.has(p.id));

  const add = (player: RosterPlayer) =>
    setOrder((current) => [
      ...current,
      {
        playerId: player.id,
        displayName: player.displayName,
        jerseyNumber: player.jerseyNumber,
        battingOrder: current.length + 1,
        position: player.position,
      },
    ]);

  const remove = (playerId: string) =>
    setOrder((current) =>
      current
        .filter((o) => o.playerId !== playerId)
        .map((o, i) => ({ ...o, battingOrder: i + 1 })),
    );

  const move = (index: number, delta: number) =>
    setOrder((current) => {
      const next = [...current];
      const target = index + delta;
      if (target < 0 || target >= next.length) return current;
      [next[index], next[target]] = [next[target], next[index]];
      return next.map((o, i) => ({ ...o, battingOrder: i + 1 }));
    });

  const setPosition = (playerId: string, position: string) =>
    setOrder((current) =>
      current.map((o) => (o.playerId === playerId ? { ...o, position: position || null } : o)),
    );

  const persist = (then?: () => void) =>
    startTransition(async () => {
      const result = await saveLineup(
        gameId,
        order.map((o) => ({
          playerId: o.playerId,
          battingOrder: o.battingOrder,
          position: o.position,
        })),
      );
      setMessage(result.error ?? result.success ?? null);
      if (!result.error) then?.();
    });

  const begin = () =>
    startTransition(async () => {
      const saved = await saveLineup(
        gameId,
        order.map((o) => ({
          playerId: o.playerId,
          battingOrder: o.battingOrder,
          position: o.position,
        })),
      );
      if (saved.error) {
        setMessage(saved.error);
        return;
      }
      const started = await startGame(gameId);
      setMessage(started.error ?? null);
    });

  const copyFromSibling = () =>
    startTransition(async () => {
      if (!siblingGame) return;
      const result = await copyLineupFrom(gameId, siblingGame.id);
      setMessage(result.error ?? result.success ?? null);
    });

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      {siblingGame && order.length === 0 && (
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3 border-l-[3px] border-gold-400 bg-ink-900 px-4 py-3">
          <p className="text-sm text-steel-300">
            Reuse the lineup from game {siblingGame.gameNumber} of this doubleheader?
          </p>
          <AdminButton variant="primary" type="button" onClick={copyFromSibling} disabled={pending}>
            Copy lineup
          </AdminButton>
        </div>
      )}

      <section className="mb-8">
        <h2 className="type-eyebrow mb-3 text-steel-400">
          Batting order ({order.length})
        </h2>

        {order.length === 0 ? (
          <p className="bg-ink-900 px-4 py-6 text-sm text-steel-500">
            Add players from the roster below.
          </p>
        ) : (
          <ol className="flex flex-col gap-px bg-white/5">
            {order.map((entry, i) => (
              <li key={entry.playerId} className="flex items-center gap-3 bg-ink-900 px-3 py-2.5">
                <span className="num-table w-6 shrink-0 text-center text-steel-500">{i + 1}</span>
                <JerseyNumber value={entry.jerseyNumber} size="sm" tone="ghost" />

                <span className="min-w-0 flex-1 truncate text-sm text-white">
                  {entry.displayName}
                </span>

                <select
                  value={entry.position ?? ''}
                  onChange={(e) => setPosition(entry.playerId, e.target.value)}
                  aria-label={`Position for ${entry.displayName}`}
                  className="shrink-0 bg-ink-800 px-2 py-1.5 text-xs text-white ring-1 ring-inset ring-white/10"
                >
                  <option value="">—</option>
                  {positions.map((p) => (
                    <option key={p.code} value={p.code}>{p.code}</option>
                  ))}
                </select>

                <div className="flex shrink-0">
                  <IconButton label={`Move ${entry.displayName} up`} onClick={() => move(i, -1)} disabled={i === 0}>
                    <ArrowUp size={16} />
                  </IconButton>
                  <IconButton label={`Move ${entry.displayName} down`} onClick={() => move(i, 1)} disabled={i === order.length - 1}>
                    <ArrowDown size={16} />
                  </IconButton>
                  <IconButton label={`Remove ${entry.displayName}`} onClick={() => remove(entry.playerId)}>
                    <X size={16} />
                  </IconButton>
                </div>
              </li>
            ))}
          </ol>
        )}
      </section>

      {available.length > 0 && (
        <section className="mb-8">
          <h2 className="type-eyebrow mb-3 text-steel-400">Available</h2>
          <div className="flex flex-wrap gap-2">
            {available.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => add(p)}
                className="flex min-h-11 items-center gap-2 bg-ink-900 px-3 py-2 text-sm text-steel-200 ring-1 ring-inset ring-white/10 active:bg-ink-800"
              >
                <JerseyNumber value={p.jerseyNumber} size="sm" tone="ghost" />
                {p.displayName}
              </button>
            ))}
          </div>
        </section>
      )}

      {message && (
        <p role="status" className="mb-4 border-l-[3px] border-steel-600 bg-ink-900 px-4 py-3 text-sm text-steel-300">
          {message}
        </p>
      )}

      <div className="sticky bottom-0 -mx-4 flex gap-px border-t border-white/10 bg-ink-900 px-4 py-3">
        <AdminButton type="button" onClick={() => persist()} disabled={pending || order.length === 0} className="flex-1">
          Save lineup
        </AdminButton>
        <AdminButton
          type="button"
          variant="primary"
          onClick={begin}
          disabled={pending || order.length === 0}
          className="flex-1"
        >
          {pending ? 'Starting…' : 'Start game'}
        </AdminButton>
      </div>
    </div>
  );
}

function IconButton({
  children, onClick, disabled, label,
}: {
  children: React.ReactNode; onClick: () => void; disabled?: boolean; label: string;
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
