import { AdminPage, Panel } from '@/components/admin/AdminPage';
import { requireAdmin } from '@/lib/auth/session';
import { getCurrentSeason } from '@/lib/queries/seasons';
import { getPositions } from '@/lib/queries/admin';
import { PlayerForm } from '../PlayerForm';

export const dynamic = 'force-dynamic';

export default async function NewPlayerPage() {
  await requireAdmin();
  const [season, positions] = await Promise.all([getCurrentSeason(), getPositions()]);
  if (!season) return null;

  return (
    <AdminPage title="Add player" description={`Adds to the ${season.name} roster.`}>
      <Panel className="p-5 sm:p-6">
        <PlayerForm positions={positions} seasonId={season.id} />
      </Panel>
    </AdminPage>
  );
}
