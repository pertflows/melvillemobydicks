import Link from 'next/link';
import { notFound } from 'next/navigation';
import { AdminPage, AdminButton, Panel } from '@/components/admin/AdminPage';
import { requireAdmin } from '@/lib/auth/session';
import { getCurrentSeason } from '@/lib/queries/seasons';
import { getGameById } from '@/lib/queries/games';
import { getOpponents, getVenues } from '@/lib/queries/admin';
import { getRoster } from '@/lib/queries/players';
import { createClient } from '@/lib/supabase/server';
import { formatGameDateWithDay, formatGameTime, TEAM_TIME_ZONE } from '@/lib/time';
import { GameForm } from '../GameForm';
import { PotgPicker } from '../PotgPicker';
import { TZDate } from '@date-fns/tz';

export const dynamic = 'force-dynamic';

export default async function EditGamePage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;

  const [season, game, opponents, venues] = await Promise.all([
    getCurrentSeason(),
    getGameById(id),
    getOpponents(),
    getVenues(),
  ]);

  if (!season || !game) notFound();

  const [roster, { data: raw }] = await Promise.all([
    getRoster(season.id),
    (await createClient())
      .from('games')
      .select('opponent_id, venue_id, notes, scheduled_innings, our_runs_recorded, their_runs_recorded')
      .eq('id', id)
      .single(),
  ]);

  // Split the stored instant back into the local date and time fields.
  const local = new TZDate(new Date(game.startsAt), TEAM_TIME_ZONE);
  const date = `${local.getFullYear()}-${String(local.getMonth() + 1).padStart(2, '0')}-${String(local.getDate()).padStart(2, '0')}`;
  const time = `${String(local.getHours()).padStart(2, '0')}:${String(local.getMinutes()).padStart(2, '0')}`;

  return (
    <AdminPage
      title={`vs ${game.opponentName ?? 'TBD'}`}
      description={`${formatGameDateWithDay(game.startsAt)} · ${formatGameTime(game.startsAt)}`}
      actions={
        <>
          <AdminButton href={`/admin/games/${game.id}/stats`}>Correct stats</AdminButton>
          <AdminButton href={`/admin/live/${game.id}`} variant="primary">
            {game.status === 'final' ? 'Correct game' : 'Open scorebook'}
          </AdminButton>
          <Link href={`/schedule/${game.id}`} className="type-eyebrow inline-flex items-center px-4 py-2.5 text-steel-400 hover:text-white">
            View public page →
          </Link>
        </>
      }
    >
      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <Panel className="p-5 sm:p-6">
          <GameForm
            seasonId={season.id}
            opponents={opponents.map((o) => ({ id: o.id, label: o.name }))}
            venues={venues.map((v) => ({ id: v.id, label: v.display_name ?? v.name }))}
            values={{
              id: game.id,
              opponentId: raw?.opponent_id ?? null,
              venueId: raw?.venue_id ?? null,
              date,
              time,
              homeAway: game.homeAway,
              gameNumber: game.gameNumber,
              scheduledInnings: raw?.scheduled_innings ?? 7,
              status: game.status,
              ourRuns: raw?.our_runs_recorded ?? null,
              theirRuns: raw?.their_runs_recorded ?? null,
              notes: raw?.notes ?? null,
            }}
          />
        </Panel>

        <Panel title="Player of the Game" className="p-5">
          <PotgPicker
            gameId={game.id}
            players={roster.map((p) => ({
              id: p.id,
              label: `${p.jerseyNumber !== null ? `#${p.jerseyNumber} ` : ''}${p.displayName}`,
            }))}
            currentSlug={game.potg?.playerSlug ?? null}
            currentName={game.potg?.displayName ?? null}
          />
        </Panel>
      </div>
    </AdminPage>
  );
}
