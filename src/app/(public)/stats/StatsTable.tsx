'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { JerseyNumber } from '@/components/sports/JerseyNumber';
import { formatRate } from '@/lib/format';
import { cn } from '@/lib/cn';
import { sortLeaders, type LeaderCategory, type LeaderRow } from '@/lib/stats/leaders';

const COLUMNS: { key: LeaderCategory; label: string; title: string }[] = [
  { key: 'batting_average', label: 'AVG', title: 'Batting average' },
  { key: 'home_runs', label: 'HR', title: 'Home runs' },
  { key: 'rbi', label: 'RBI', title: 'Runs batted in' },
  { key: 'hits', label: 'H', title: 'Hits' },
  { key: 'walks', label: 'BB', title: 'Walks' },
  { key: 'games', label: 'G', title: 'Games played' },
];

/**
 * Sortable season batting table.
 *
 * A real <table> with scope'd headers and aria-sort, so it stays navigable to
 * screen readers and keyboard users rather than being a grid of divs.
 */
export function StatsTable({ rows }: { rows: LeaderRow[] }) {
  const [sort, setSort] = useState<LeaderCategory>('batting_average');
  const sorted = useMemo(() => sortLeaders(rows, sort), [rows, sort]);

  return (
    <>
      <div className="mb-4 inline-flex flex-wrap gap-px bg-white/10">
        {COLUMNS.map((c) => (
          <button
            key={c.key}
            type="button"
            onClick={() => setSort(c.key)}
            aria-pressed={sort === c.key}
            className={cn(
              'type-eyebrow px-4 py-2.5 transition-colors',
              sort === c.key
                ? 'bg-gold-400 text-navy-950'
                : 'bg-ink-900 text-steel-400 hover:bg-ink-800 hover:text-white',
            )}
          >
            {c.label}
          </button>
        ))}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-3xl border-collapse">
          <caption className="sr-only">
            Season batting statistics, sorted by {COLUMNS.find((c) => c.key === sort)?.title}
          </caption>
          <thead>
            <tr className="hairline-b">
              <th scope="col" className="type-eyebrow px-3 py-3 text-left text-steel-500">#</th>
              <th scope="col" className="type-eyebrow px-3 py-3 text-left text-steel-500">Player</th>
              <th scope="col" className="type-eyebrow px-3 py-3 text-left text-steel-500">Pos</th>
              {COLUMNS.map((c) => (
                <th
                  key={c.key}
                  scope="col"
                  title={c.title}
                  aria-sort={sort === c.key ? 'descending' : 'none'}
                  className={cn(
                    'type-eyebrow px-3 py-3 text-right',
                    sort === c.key ? 'text-gold-400' : 'text-steel-500',
                  )}
                >
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((r, i) => (
              <tr key={r.playerId} className="hairline-b transition-colors hover:bg-ink-900">
                <td className="num-table px-3 py-3 text-steel-500">{i + 1}</td>
                <td className="px-3 py-3">
                  <Link href={`/roster/${r.slug}`} className="flex items-center gap-2.5 group">
                    <JerseyNumber value={r.jerseyNumber} size="sm" tone={i === 0 ? 'gold' : 'ghost'} />
                    <span className="type-section text-sm text-white group-hover:text-gold-200">
                      {r.displayName}
                    </span>
                  </Link>
                </td>
                <td className="px-3 py-3 text-xs text-steel-500">{r.positionLabel}</td>
                <td className={cn('num-table px-3 py-3 text-right', sort === 'batting_average' ? 'text-gold-400' : 'text-white')}>
                  {formatRate(r.battingAverageDisplay)}
                </td>
                <td className={cn('num-table px-3 py-3 text-right', sort === 'home_runs' ? 'text-gold-400' : 'text-steel-200')}>{r.homeRuns}</td>
                <td className={cn('num-table px-3 py-3 text-right', sort === 'rbi' ? 'text-gold-400' : 'text-steel-200')}>{r.rbi}</td>
                <td className={cn('num-table px-3 py-3 text-right', sort === 'hits' ? 'text-gold-400' : 'text-steel-200')}>{r.hits}</td>
                <td className={cn('num-table px-3 py-3 text-right', sort === 'walks' ? 'text-gold-400' : 'text-steel-200')}>{r.walks}</td>
                <td className={cn('num-table px-3 py-3 text-right', sort === 'games' ? 'text-gold-400' : 'text-steel-200')}>{r.games}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
