import Link from 'next/link';
import { notFound } from 'next/navigation';
import { AdminPage, Panel } from '@/components/admin/AdminPage';
import { requireAdmin } from '@/lib/auth/session';
import { getCurrentSeason } from '@/lib/queries/seasons';
import { getAdminRoster, getPositions } from '@/lib/queries/admin';
import { PlayerForm } from '../PlayerForm';

export const dynamic = 'force-dynamic';

export default async function EditPlayerPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();
  const { id } = await params;

  const [season, positions] = await Promise.all([getCurrentSeason(), getPositions()]);
  if (!season) return null;

  const player = (await getAdminRoster(season.id)).find((p) => p.id === id);
  if (!player) notFound();

  return (
    <AdminPage
      title={player.displayName}
      description={`${season.name} season roster entry.`}
      actions={
        <Link
          href={`/roster/${player.slug}`}
          className="type-eyebrow inline-flex items-center px-4 py-2.5 text-steel-400 hover:text-white"
        >
          View public page →
        </Link>
      }
    >
      <Panel className="p-5 sm:p-6">
        <PlayerForm player={player} positions={positions} seasonId={season.id} />
      </Panel>
    </AdminPage>
  );
}
