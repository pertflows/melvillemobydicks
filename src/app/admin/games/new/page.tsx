import { AdminPage, Panel } from '@/components/admin/AdminPage';
import { requireAdmin } from '@/lib/auth/session';
import { getCurrentSeason } from '@/lib/queries/seasons';
import { getOpponents, getVenues } from '@/lib/queries/admin';
import { GameForm } from '../GameForm';

export const dynamic = 'force-dynamic';

export default async function NewGamePage() {
  await requireAdmin();
  const [season, opponents, venues] = await Promise.all([
    getCurrentSeason(),
    getOpponents(),
    getVenues(),
  ]);
  if (!season) return null;

  const today = new Date().toISOString().slice(0, 10);

  return (
    <AdminPage title="Create game" description={`Adds to the ${season.name} schedule.`}>
      <Panel className="p-5 sm:p-6">
        <GameForm
          seasonId={season.id}
          opponents={opponents.map((o) => ({ id: o.id, label: o.name }))}
          venues={venues.map((v) => ({ id: v.id, label: v.display_name ?? v.name }))}
          values={{
            date: today,
            time: '17:00',
            homeAway: 'home',
            gameNumber: 1,
            scheduledInnings: 7,
            status: 'scheduled',
            ourRuns: null,
            theirRuns: null,
            notes: null,
          }}
        />
      </Panel>
    </AdminPage>
  );
}
