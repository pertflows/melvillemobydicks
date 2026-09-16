'use client';

import { Fragment, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { JerseyNumber } from '@/components/sports/JerseyNumber';
import { AdminButton } from '@/components/admin/AdminPage';
import { LegacyBaselineForm } from './LegacyBaselineForm';
import { formatRate } from '@/lib/format';
import { cn } from '@/lib/cn';
import type { AdminPlayerRow } from '@/lib/queries/admin';

const STATUS_STYLES: Record<string, string> = {
  active: 'text-win',
  inactive: 'text-steel-400',
  alumni: 'text-navy-300',
};

export function RosterTable({
  players,
  seasonId,
  seasonName,
}: {
  players: AdminPlayerRow[];
  seasonId: string;
  seasonName: string;
}) {
  const [editingBaseline, setEditingBaseline] = useState<string | null>(null);

  return (
    <div className="overflow-hidden ring-1 ring-inset ring-white/10">
      <table className="w-full border-collapse">
        <caption className="sr-only">Roster for the {seasonName} season</caption>
        <thead>
          <tr className="border-b border-white/10 bg-ink-800">
            <th scope="col" className="type-eyebrow px-4 py-3 text-left text-steel-500">Player</th>
            <th scope="col" className="type-eyebrow px-4 py-3 text-left text-steel-500">Position</th>
            <th scope="col" className="type-eyebrow px-4 py-3 text-left text-steel-500">Status</th>
            <th scope="col" className="type-eyebrow px-4 py-3 text-right text-steel-500">Legacy AVG</th>
            <th scope="col" className="type-eyebrow px-4 py-3 text-right text-steel-500">
              <span className="sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {players.map((p) => (
            <Fragment key={p.id}>
              <tr className="border-b border-white/5 bg-ink-900 hover:bg-ink-800">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <JerseyNumber value={p.jerseyNumber} size="sm" tone="ghost" />
                    {p.photoUrl ? (
                      <Image
                        src={p.photoUrl}
                        alt=""
                        width={32}
                        height={40}
                        className="h-10 w-8 shrink-0 object-cover object-top"
                      />
                    ) : (
                      <span className="h-10 w-8 shrink-0 bg-navy-900" aria-hidden />
                    )}
                    <div className="min-w-0">
                      <p className="truncate text-sm text-white">{p.displayName}</p>
                      {!p.inSeason && (
                        <p className="text-xs text-steel-600">Not on the {seasonName} roster</p>
                      )}
                    </div>
                  </div>
                </td>

                <td className="px-4 py-3 text-sm text-steel-400">{p.position ?? '—'}</td>

                <td className={cn('px-4 py-3 text-sm capitalize', STATUS_STYLES[p.status])}>
                  {p.status}
                </td>

                <td className="num-table px-4 py-3 text-right text-steel-300">
                  {p.legacyBaseline
                    ? formatRate(p.legacyBaseline.battingAverageOverride)
                    : '—'}
                  {p.legacyBaseline && p.legacyBaseline.atBats === null && (
                    <span className="ml-1 text-[10px] text-steel-600" title="At-bats unknown">
                      no AB
                    </span>
                  )}
                </td>

                <td className="px-4 py-3">
                  <div className="flex justify-end gap-2">
                    <Link
                      href={`/admin/roster/${p.id}`}
                      className="type-eyebrow px-3 py-1.5 text-steel-400 hover:text-white"
                    >
                      Edit
                    </Link>
                    <button
                      type="button"
                      onClick={() => setEditingBaseline(editingBaseline === p.id ? null : p.id)}
                      aria-expanded={editingBaseline === p.id}
                      className="type-eyebrow px-3 py-1.5 text-steel-400 hover:text-white"
                    >
                      Baseline
                    </button>
                  </div>
                </td>
              </tr>

              {editingBaseline === p.id && (
                <tr className="border-b border-white/5 bg-ink-950">
                  <td colSpan={5} className="px-4 py-5">
                    <LegacyBaselineForm
                      player={p}
                      seasonId={seasonId}
                      seasonName={seasonName}
                      onDone={() => setEditingBaseline(null)}
                    />
                  </td>
                </tr>
              )}
            </Fragment>
          ))}
        </tbody>
      </table>

      {players.length === 0 && (
        <p className="bg-ink-900 px-4 py-10 text-center text-sm text-steel-500">
          No players yet.
        </p>
      )}

      <div className="border-t border-white/10 bg-ink-800 px-4 py-3">
        <AdminButton href="/admin/roster/new" variant="primary">
          Add player
        </AdminButton>
      </div>
    </div>
  );
}
