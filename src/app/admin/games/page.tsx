import Link from 'next/link';
import { AdminPage, AdminButton, Panel } from '@/components/admin/AdminPage';
import { StatusLabel } from '@/components/sports/StatusLabel';
import { requireAdmin } from '@/lib/auth/session';
import { getCurrentSeason } from '@/lib/queries/seasons';
import { getSchedule } from '@/lib/queries/games';
import { getGamesAwaitingReview } from '@/lib/queries/admin';
import { formatScore } from '@/lib/format';
import { formatGameDateWithDay, formatGameTime } from '@/lib/time';

export const dynamic = 'force-dynamic';

export default async function AdminGamesPage() {
  await requireAdmin();
  const season = await getCurrentSeason();
  if (!season) return null;

  const [games, needsReview] = await Promise.all([
    getSchedule(season.id),
    getGamesAwaitingReview(season.id),
  ]);

  return (
    <AdminPage
      title="Games"
      description={`${season.name} season · ${games.length} games`}
      actions={<AdminButton href="/admin/games/new" variant="primary">Create game</AdminButton>}
    >
      {needsReview.length > 0 && (
        <Panel title="Awaiting review" className="mb-6">
          <ul className="divide-y divide-white/5">
            {needsReview.map((g) => (
              <li key={g.id} className="flex items-center justify-between gap-4 px-5 py-3">
                <span className="text-sm text-steel-300">
                  vs {g.opponentName} · {formatGameDateWithDay(g.startsAt)}
                </span>
                <div className="flex gap-2">
                  <AdminButton href={`/admin/live/${g.id}`} variant="primary">Score</AdminButton>
                  <AdminButton href={`/admin/games/${g.id}`}>Edit</AdminButton>
                </div>
              </li>
            ))}
          </ul>
        </Panel>
      )}

      <div className="overflow-hidden ring-1 ring-inset ring-white/10">
        <table className="w-full border-collapse">
          <caption className="sr-only">All games in the {season.name} season</caption>
          <thead>
            <tr className="border-b border-white/10 bg-ink-800">
              <th scope="col" className="type-eyebrow px-4 py-3 text-left text-steel-500">Date</th>
              <th scope="col" className="type-eyebrow px-4 py-3 text-left text-steel-500">Opponent</th>
              <th scope="col" className="type-eyebrow hidden px-4 py-3 text-left text-steel-500 sm:table-cell">Venue</th>
              <th scope="col" className="type-eyebrow px-4 py-3 text-right text-steel-500">Score</th>
              <th scope="col" className="type-eyebrow px-4 py-3 text-right text-steel-500">Status</th>
              <th scope="col" className="type-eyebrow px-4 py-3 text-right text-steel-500"><span className="sr-only">Actions</span></th>
            </tr>
          </thead>
          <tbody>
            {games.map((g) => (
              <tr key={g.id} className="border-b border-white/5 bg-ink-900 hover:bg-ink-800">
                <td className="whitespace-nowrap px-4 py-3 text-sm text-steel-300">
                  {formatGameDateWithDay(g.startsAt)}
                  <span className="block text-xs text-steel-600">{formatGameTime(g.startsAt)}</span>
                </td>
                <td className="px-4 py-3 text-sm text-white">
                  {g.opponentName ?? 'TBD'}
                  {g.gameNumber > 1 && (
                    <span className="ml-2 text-xs text-steel-600">G{g.gameNumber}</span>
                  )}
                </td>
                <td className="hidden px-4 py-3 text-sm text-steel-500 sm:table-cell">{g.venueName}</td>
                <td className="num-table px-4 py-3 text-right text-white">
                  {g.status === 'final' ? formatScore(g.ourRuns, g.theirRuns) : '—'}
                </td>
                <td className="px-4 py-3 text-right">
                  <StatusLabel status={g.status} result={g.result} />
                </td>
                <td className="px-4 py-3">
                  <div className="flex justify-end gap-2">
                    {g.status !== 'final' && (
                      <Link href={`/admin/live/${g.id}`} className="type-eyebrow px-3 py-1.5 text-gold-400 hover:text-gold-300">
                        Score
                      </Link>
                    )}
                    <Link href={`/admin/games/${g.id}`} className="type-eyebrow px-3 py-1.5 text-steel-400 hover:text-white">
                      Edit
                    </Link>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AdminPage>
  );
}
