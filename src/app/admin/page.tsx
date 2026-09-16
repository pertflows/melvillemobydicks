import Link from 'next/link';
import { AdminPage, AdminButton, Panel } from '@/components/admin/AdminPage';
import { StatusLabel } from '@/components/sports/StatusLabel';
import { requireAdmin } from '@/lib/auth/session';
import { getCurrentSeason } from '@/lib/queries/seasons';
import { getTeamRecord } from '@/lib/queries/team';
import { getRecentResults, getUpcomingGames } from '@/lib/queries/games';
import { getAdminCounts, getRecentActivity } from '@/lib/queries/admin';
import { getRecentAwards } from '@/lib/queries/content';
import { formatRecord, formatScore } from '@/lib/format';
import { formatGameDateWithDay, formatGameTime } from '@/lib/time';

export const dynamic = 'force-dynamic';

export default async function AdminDashboard() {
  await requireAdmin();

  const season = await getCurrentSeason();
  if (!season) {
    return (
      <AdminPage title="Dashboard" description="No season exists yet.">
        <Panel>
          <p className="px-5 py-8 text-sm text-steel-400">
            Create a season to begin.
          </p>
        </Panel>
      </AdminPage>
    );
  }

  const [record, counts, upcoming, results, awards, activity] = await Promise.all([
    getTeamRecord(season.id),
    getAdminCounts(season.id),
    getUpcomingGames(season.id, 1),
    getRecentResults(season.id, 1),
    getRecentAwards(season.id, 1),
    getRecentActivity(6),
  ]);

  const nextGame = upcoming[0] ?? null;
  const lastGame = results[0] ?? null;
  const potg = awards[0] ?? null;

  return (
    <AdminPage
      title="Dashboard"
      description={`${season.name} season · ${formatRecord(record.wins, record.losses, record.ties)}`}
      actions={
        <>
          {nextGame ? (
            <AdminButton href={`/admin/live/${nextGame.id}`} variant="primary">
              Start Game
            </AdminButton>
          ) : (
            <AdminButton href="/admin/games/new" variant="primary">
              Create Game
            </AdminButton>
          )}
          <AdminButton href="/admin/roster">Edit Roster</AdminButton>
          <AdminButton href="/admin/posts/new">Write Log</AdminButton>
        </>
      }
    >
      {counts.liveGames > 0 && (
        <Link
          href="/admin/live"
          className="mb-6 flex items-center justify-between gap-4 border-l-[3px] border-live bg-live/10 px-5 py-4 transition-colors hover:bg-live/15"
        >
          <span className="type-section text-sm text-white">
            A game is in progress
          </span>
          <StatusLabel status="live" />
        </Link>
      )}

      {/* -- counters ------------------------------------------------------ */}
      <div className="mb-8 grid grid-cols-2 gap-px bg-white/10 lg:grid-cols-4">
        <Metric label="Record" value={formatRecord(record.wins, record.losses, record.ties)} accent />
        <Metric label="Active Roster" value={String(counts.activeRoster)} />
        <Metric label="Games Scheduled" value={String(counts.scheduledGames)} />
        <Metric
          label="Awaiting Review"
          value={String(counts.awaitingReview)}
          warn={counts.awaitingReview > 0}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="Next game">
          {nextGame ? (
            <div className="px-5 py-5">
              <p className="type-section text-lg text-white">vs {nextGame.opponentName ?? 'TBD'}</p>
              <p className="mt-2 text-sm text-steel-400">
                {formatGameDateWithDay(nextGame.startsAt)} · {formatGameTime(nextGame.startsAt)}
              </p>
              <p className="mt-1 text-sm text-steel-500">{nextGame.venueName}</p>
              <div className="mt-5 flex flex-wrap gap-2">
                <AdminButton href={`/admin/live/${nextGame.id}`} variant="primary">
                  Start Scorebook
                </AdminButton>
                <AdminButton href={`/admin/games/${nextGame.id}`}>Edit</AdminButton>
              </div>
            </div>
          ) : (
            <Empty>No upcoming games scheduled.</Empty>
          )}
        </Panel>

        <Panel title="Previous game">
          {lastGame ? (
            <div className="px-5 py-5">
              <div className="flex items-baseline justify-between gap-4">
                <p className="type-section text-lg text-white">
                  vs {lastGame.opponentName ?? 'Unknown'}
                </p>
                <span className="num-stat text-white">
                  {formatScore(lastGame.ourRuns, lastGame.theirRuns)}
                </span>
              </div>
              <div className="mt-2 flex items-center gap-3">
                <StatusLabel status={lastGame.status} result={lastGame.result} />
                <span className="text-sm text-steel-500">
                  {formatGameDateWithDay(lastGame.startsAt)}
                </span>
              </div>
              <div className="mt-5">
                <AdminButton href={`/admin/games/${lastGame.id}`}>Review game</AdminButton>
              </div>
            </div>
          ) : (
            <Empty>No completed games yet.</Empty>
          )}
        </Panel>

        <Panel title="Most recent Player of the Game">
          {potg ? (
            <div className="flex items-center justify-between gap-4 px-5 py-5">
              <div>
                <p className="type-section text-base text-white">{potg.displayName}</p>
                <p className="mt-1 text-sm text-steel-500">
                  {potg.opponentName ? `vs ${potg.opponentName}` : ''}
                </p>
              </div>
              <AdminButton href="/admin/games">Change</AdminButton>
            </div>
          ) : (
            <Empty>No awards recorded this season.</Empty>
          )}
        </Panel>

        <Panel title="Recent activity">
          {activity.length > 0 ? (
            <ul className="divide-y divide-white/5">
              {activity.map((a) => (
                <li key={a.id} className="flex items-baseline justify-between gap-4 px-5 py-3">
                  <span className="min-w-0 text-sm text-steel-300">
                    <span className="text-steel-500">{a.action}</span>{' '}
                    {a.summary ?? a.entity.replace(/_/g, ' ')}
                  </span>
                  <time className="shrink-0 text-xs text-steel-600" dateTime={a.createdAt}>
                    {formatGameDateWithDay(a.createdAt)}
                  </time>
                </li>
              ))}
            </ul>
          ) : (
            <Empty>Nothing recorded yet.</Empty>
          )}
        </Panel>
      </div>
    </AdminPage>
  );
}

function Metric({
  label,
  value,
  accent,
  warn,
}: {
  label: string;
  value: string;
  accent?: boolean;
  warn?: boolean;
}) {
  return (
    <div className="bg-ink-900 px-5 py-5">
      <p className="type-eyebrow mb-2 text-[10px] text-steel-500">{label}</p>
      <p
        className={`num-stat-xl ${
          warn ? 'text-gold-400' : accent ? 'text-gold-400' : 'text-white'
        }`}
      >
        {value}
      </p>
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="px-5 py-8 text-sm text-steel-500">{children}</p>;
}
