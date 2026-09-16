'use client';

import { useState, useTransition } from 'react';
import { setPlayerOfTheGame } from '@/lib/actions/games';
import { AdminButton } from '@/components/admin/AdminPage';

export function PotgPicker({
  gameId,
  players,
  currentSlug,
  currentName,
}: {
  gameId: string;
  players: { id: string; label: string }[];
  currentSlug: string | null;
  currentName: string | null;
}) {
  const [selected, setSelected] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const save = (playerId: string | null) =>
    startTransition(async () => {
      const result = await setPlayerOfTheGame(gameId, playerId);
      setMessage(result.error ?? result.success ?? null);
    });

  return (
    <div className="space-y-4">
      {currentName ? (
        <p className="text-sm text-white">
          <span className="type-eyebrow mr-2 text-gold-400">★</span>
          {currentName}
        </p>
      ) : (
        <p className="text-sm text-steel-500">No award set for this game.</p>
      )}

      <div>
        <label htmlFor="potg" className="type-eyebrow mb-2 block text-steel-400">
          {currentSlug ? 'Change to' : 'Award to'}
        </label>
        <select
          id="potg"
          value={selected}
          onChange={(e) => setSelected(e.target.value)}
          className="w-full bg-ink-800 px-4 py-2.5 text-sm text-white ring-1 ring-inset ring-white/10 focus:ring-2 focus:ring-navy-400"
        >
          <option value="">— Select a player —</option>
          {players.map((p) => (
            <option key={p.id} value={p.id}>{p.label}</option>
          ))}
        </select>
      </div>

      {message && <p role="status" className="text-sm text-steel-300">{message}</p>}

      <div className="flex gap-2">
        <AdminButton
          variant="primary"
          type="button"
          disabled={!selected || pending}
          onClick={() => selected && save(selected)}
        >
          {pending ? 'Saving…' : 'Set award'}
        </AdminButton>
        {currentSlug && (
          <AdminButton variant="danger" type="button" disabled={pending} onClick={() => save(null)}>
            Clear
          </AdminButton>
        )}
      </div>
    </div>
  );
}
