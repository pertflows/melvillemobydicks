import { AdminPage, AdminButton } from '@/components/admin/AdminPage';
import { requireAdmin } from '@/lib/auth/session';
import { getCurrentSeason } from '@/lib/queries/seasons';
import { getAdminRoster } from '@/lib/queries/admin';
import { RosterTable } from './RosterTable';

export const dynamic = 'force-dynamic';

export default async function AdminRosterPage() {
  await requireAdmin();
  const season = await getCurrentSeason();
  if (!season) return null;

  const players = await getAdminRoster(season.id);
  const missingAtBats = players.filter(
    (p) => p.legacyBaseline && p.legacyBaseline.atBats === null,
  ).length;

  return (
    <AdminPage
      title="Roster"
      description={`${season.name} season · ${players.filter((p) => p.status === 'active').length} active`}
      actions={<AdminButton href="/admin/roster/new" variant="primary">Add player</AdminButton>}
    >
      {missingAtBats > 0 && (
        <p className="mb-6 border-l-[3px] border-steel-600 bg-ink-900 px-4 py-3 text-sm text-steel-400">
          {missingAtBats} imported season {missingAtBats === 1 ? 'line has' : 'lines have'} no
          at-bat total, so {missingAtBats === 1 ? 'its' : 'their'} average is the figure the old
          site displayed rather than a computed one. Add at-bats from the scorebook under
          &ldquo;Baseline&rdquo; to convert them.
        </p>
      )}

      <RosterTable players={players} seasonId={season.id} seasonName={season.name} />
    </AdminPage>
  );
}
