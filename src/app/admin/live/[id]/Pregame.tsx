'use client';

import { useState, useTransition } from 'react';
import { AdminButton } from '@/components/admin/AdminPage';
import { LineupEditor } from '@/components/admin/LineupEditor';
import { copyLineupFrom, saveLineup, startGame } from '@/lib/actions/scoring';
import type { LineupEntry } from '@/lib/queries/scoring';
import type { RosterPlayer } from '@/lib/queries/players';

/** Pregame setup: build the batting order, then start the game. */
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

  const toEntries = () =>
    order.map((o) => ({
      playerId: o.playerId,
      battingOrder: o.battingOrder,
      position: o.position,
    }));

  const persist = () =>
    startTransition(async () => {
      const result = await saveLineup(gameId, toEntries());
      setMessage(result.error ?? result.success ?? null);
    });

  const begin = () =>
    startTransition(async () => {
      const saved = await saveLineup(gameId, toEntries());
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

      <LineupEditor
        order={order}
        onChange={setOrder}
        roster={roster}
        positions={positions}
        disabled={pending}
      />

      {message && (
        <p role="status" className="mb-4 border-l-[3px] border-steel-600 bg-ink-900 px-4 py-3 text-sm text-steel-300">
          {message}
        </p>
      )}

      <div className="sticky bottom-0 -mx-4 flex gap-px border-t border-white/10 bg-ink-900 px-4 py-3">
        <AdminButton type="button" onClick={persist} disabled={pending || order.length === 0} className="flex-1">
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
