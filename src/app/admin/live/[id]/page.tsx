import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireScorekeeper } from '@/lib/auth/session';
import { getScorebook, getResultTypes, getSiblingGame } from '@/lib/queries/scoring';
import { getCurrentSeason } from '@/lib/queries/seasons';
import { getRoster } from '@/lib/queries/players';
import { getPositions } from '@/lib/queries/admin';
import { formatGameDateWithDay, formatGameTime } from '@/lib/time';
import { Pregame } from './Pregame';
import { Scorebook } from './Scorebook';

export const dynamic = 'force-dynamic';

export default async function LiveGamePage({ params }: { params: Promise<{ id: string }> }) {
  await requireScorekeeper();
  const { id } = await params;

  const game = await getScorebook(id);
  if (!game) notFound();

  const isLive = game.status === 'live';

  const [resultTypes, season] = await Promise.all([getResultTypes(), getCurrentSeason()]);
  const [roster, positions] = await Promise.all([
    season ? getRoster(season.id) : Promise.resolve([]),
    getPositions(),
  ]);

  return (
    <div className="min-h-screen bg-ink-950">
      <header className="border-b border-white/10 bg-ink-900 px-4 py-3">
        <div className="mx-auto flex max-w-2xl items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="type-section truncate text-sm text-white">
              vs {game.opponentName ?? 'TBD'}
              {game.gameNumber > 1 && (
                <span className="ml-2 text-steel-500">Game {game.gameNumber}</span>
              )}
            </p>
            <p className="truncate text-xs text-steel-500">
              {formatGameDateWithDay(game.startsAt)} · {formatGameTime(game.startsAt)}
              {game.venueName && ` · ${game.venueName}`}
            </p>
          </div>
          <Link href="/admin/games" className="type-eyebrow shrink-0 text-steel-500 hover:text-white">
            Exit
          </Link>
        </div>
      </header>

      {isLive ? (
        <Scorebook
          gameId={game.gameId}
          opponentName={game.opponentName}
          homeAway={game.homeAway}
          scheduledInnings={game.scheduledInnings}
          lineup={game.lineup}
          plateAppearances={game.plateAppearances}
          inningRuns={game.inningRuns}
          innings={game.innings}
          resultTypes={resultTypes}
          roster={roster}
          positions={positions}
        />
      ) : (
        <>
          <div className="mx-auto max-w-2xl px-4 pt-6">
            <h1 className="type-section text-xl text-white">Pregame</h1>
            <p className="mt-2 text-sm text-steel-400">
              Set the batting order and defensive positions, then start the game.
            </p>
          </div>
          <Pregame
            gameId={game.gameId}
            roster={roster}
            positions={positions}
            existing={game.lineup}
            siblingGame={await getSiblingGame(game.gameId, game.seriesKey)}
          />
        </>
      )}
    </div>
  );
}
