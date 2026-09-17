'use client';

import { useState, useTransition } from 'react';
import { X } from 'lucide-react';
import { LineupEditor } from '@/components/admin/LineupEditor';
import { saveLineup } from '@/lib/actions/scoring';
import type { LineupEntry } from '@/lib/queries/scoring';
import type { RosterPlayer } from '@/lib/queries/players';

/**
 * Change the lineup without leaving the game.
 *
 * Substitutions, late arrivals and someone going off injured all happen after
 * the first pitch. Anyone who has already batted keeps their plate appearances
 * and statistics whether or not they stay in the order, because plays reference
 * the player rather than the lineup row.
 */
export function LineupSheet({
  gameId,
  currentInning,
  existing,
  roster,
  positions,
  battedPlayerIds,
  onClose,
}: {
  gameId: string;
  currentInning: number;
  existing: LineupEntry[];
  roster: RosterPlayer[];
  positions: { code: string; label: string }[];
  battedPlayerIds: Set<string>;
  onClose: () => void;
}) {
  const [order, setOrder] = useState<LineupEntry[]>(existing);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const save = () =>
    startTransition(async () => {
      const result = await saveLineup(
        gameId,
        order.map((o) => ({
          playerId: o.playerId,
          battingOrder: o.battingOrder,
          position: o.position,
        })),
        { currentInning },
      );
      if (result.error) {
        setMessage(result.error);
        return;
      }
      onClose();
    });

  const droppedAfterBatting = existing.filter(
    (e) => battedPlayerIds.has(e.playerId) && !order.some((o) => o.playerId === e.playerId),
  );

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Edit the lineup"
      className="fixed inset-0 z-50 flex flex-col bg-ink-950/97 backdrop-blur-sm"
    >
      <header className="flex items-center justify-between border-b border-white/10 px-4 py-3">
        <div>
          <h2 className="type-section text-sm text-white">Edit lineup</h2>
          <p className="type-eyebrow mt-0.5 text-[9px] text-steel-500">Inning {currentInning}</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="-mr-2 inline-flex h-11 w-11 items-center justify-center text-steel-300"
        >
          <X size={22} />
        </button>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5">
        <LineupEditor
          order={order}
          onChange={setOrder}
          roster={roster}
          positions={positions}
          battedPlayerIds={battedPlayerIds}
          disabled={pending}
        />

        {droppedAfterBatting.length > 0 && (
          <p className="mb-4 border-l-[3px] border-gold-400 bg-ink-900 px-4 py-3 text-xs leading-relaxed text-steel-300">
            {droppedAfterBatting.map((p) => p.displayName).join(', ')}{' '}
            {droppedAfterBatting.length === 1 ? 'has' : 'have'} already batted. Removing{' '}
            {droppedAfterBatting.length === 1 ? 'them' : 'them'} from the order keeps every
            plate appearance and stat already recorded — it only changes who bats from here.
          </p>
        )}

        <p className="border-l-[3px] border-steel-700 pl-4 text-xs leading-relaxed text-steel-500">
          Batting resumes from whoever is due up, so adding a player mid-innings slots them
          into the rotation rather than restarting it.
        </p>

        {message && (
          <p role="alert" className="mt-4 border-l-[3px] border-loss bg-loss/10 px-3 py-2 text-sm text-white">
            {message}
          </p>
        )}
      </div>

      <footer className="flex gap-2 border-t border-white/10 p-4">
        <button
          type="button"
          onClick={onClose}
          className="type-eyebrow min-h-12 flex-1 bg-white/10 text-white ring-1 ring-inset ring-white/15"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={save}
          disabled={pending || order.length === 0}
          className="type-eyebrow min-h-12 flex-1 bg-gold-400 text-navy-950 disabled:opacity-50"
        >
          {pending ? 'Saving…' : 'Save lineup'}
        </button>
      </footer>
    </div>
  );
}
