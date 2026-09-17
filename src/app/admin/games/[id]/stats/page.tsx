import Link from 'next/link';
import { notFound } from 'next/navigation';
import { AdminPage, AdminButton } from '@/components/admin/AdminPage';
import { requireScorekeeper } from '@/lib/auth/session';
import { getStatCorrectionSheet } from '@/lib/queries/statCorrections';
import { getCurrentSeason } from '@/lib/queries/seasons';
import { getRoster } from '@/lib/queries/players';
import { formatGameDateWithDay } from '@/lib/time';
import { StatCorrections } from './StatCorrections';

export const dynamic = 'force-dynamic';

export default async function GameStatsPage({ params }: { params: Promise<{ id: string }> }) {
  await requireScorekeeper();
  const { id } = await params;

  const sheet = await getStatCorrectionSheet(id);
  if (!sheet) notFound();

  const season = await getCurrentSeason();
  const roster = season ? await getRoster(season.id) : [];

  return (
    <AdminPage
      title="Correct stats"
      description={`vs ${sheet.opponentName ?? 'TBD'} · Game ${sheet.gameNumber} · ${formatGameDateWithDay(sheet.startsAt)}`}
      actions={
        <>
          <AdminButton href={`/admin/live/${sheet.gameId}`}>Open scorebook</AdminButton>
          <Link
            href={`/admin/games/${sheet.gameId}`}
            className="type-eyebrow inline-flex items-center px-4 py-2.5 text-steel-400 hover:text-white"
          >
            Back to game
          </Link>
        </>
      }
    >
      {sheet.siblings.length > 0 && (
        <p className="mb-5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-steel-500">
          <span className="type-eyebrow text-[10px] text-steel-600">Same night</span>
          {sheet.siblings.map((s) => (
            <Link
              key={s.id}
              href={`/admin/games/${s.id}/stats`}
              className="text-gold-400 underline underline-offset-2 hover:text-gold-300"
            >
              Correct game {s.gameNumber} →
            </Link>
          ))}
        </p>
      )}

      {sheet.status !== 'final' && (
        <p className="mb-5 border-l-[3px] border-gold-400 bg-ink-900 px-4 py-3 text-sm text-steel-300">
          This game is not finished yet. Corrections entered now will stand, but anything
          still being scored will keep moving the numbers underneath them.
        </p>
      )}

      <StatCorrections
        gameId={sheet.gameId}
        rows={sheet.rows}
        roster={roster.map((p) => ({
          id: p.id,
          displayName: p.displayName,
          jerseyNumber: p.jerseyNumber,
        }))}
        editable
      />
    </AdminPage>
  );
}
