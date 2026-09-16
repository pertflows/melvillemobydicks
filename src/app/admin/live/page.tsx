import { AdminPage, AdminButton, Panel } from '@/components/admin/AdminPage';
import { StatusLabel } from '@/components/sports/StatusLabel';
import { requireScorekeeper } from '@/lib/auth/session';
import { getCurrentSeason } from '@/lib/queries/seasons';
import { getSchedule } from '@/lib/queries/games';
import { formatGameDateWithDay, formatGameTime } from '@/lib/time';

export const dynamic = 'force-dynamic';

export default async function LiveIndexPage() {
  await requireScorekeeper();
  const season = await getCurrentSeason();
  if (!season) return null;

  const games = await getSchedule(season.id);
  const scoreable = games.filter((g) => g.status !== 'final' && g.status !== 'cancelled');

  return (
    <AdminPage
      title="Live Scorebook"
      description="Pick the game you are keeping score for."
    >
      {scoreable.length === 0 ? (
        <Panel>
          <p className="px-5 py-10 text-sm text-steel-500">
            No games left to score this season.
          </p>
        </Panel>
      ) : (
        <ul className="flex flex-col gap-px bg-white/10">
          {scoreable.map((g) => (
            <li key={g.id} className="flex flex-wrap items-center justify-between gap-4 bg-ink-900 px-5 py-4">
              <div className="min-w-0">
                <p className="type-section text-base text-white">
                  vs {g.opponentName ?? 'TBD'}
                  {g.gameNumber > 1 && <span className="ml-2 text-sm text-steel-500">G{g.gameNumber}</span>}
                </p>
                <p className="mt-1 text-sm text-steel-500">
                  {formatGameDateWithDay(g.startsAt)} · {formatGameTime(g.startsAt)}
                  {g.venueName && ` · ${g.venueName}`}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <StatusLabel status={g.status} result={g.result} />
                <AdminButton href={`/admin/live/${g.id}`} variant={g.status === 'live' ? 'primary' : 'secondary'}>
                  {g.status === 'live' ? 'Resume' : 'Open'}
                </AdminButton>
              </div>
            </li>
          ))}
        </ul>
      )}
    </AdminPage>
  );
}
