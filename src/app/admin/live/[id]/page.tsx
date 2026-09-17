import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireScorekeeper } from '@/lib/auth/session';
import { getScorebook, getResultTypes, getSiblingGame, getSeriesSiblings } from '@/lib/queries/scoring';
import { getCurrentSeason } from '@/lib/queries/seasons';
import { getRoster } from '@/lib/queries/players';
import { getPositions } from '@/lib/queries/admin';
import { formatGameDateWithDay, formatGameTime } from '@/lib/time';
import { Pregame } from './Pregame';
import { Scorebook } from './Scorebook';
import { FinalGame } from './FinalGame';

export const dynamic = 'force-dynamic';

export default async function LiveGamePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ correct?: string }>;
}) {
  await requireScorekeeper();
  const [{ id }, { correct }] = await Promise.all([params, searchParams]);

  const game = await getScorebook(id);
  if (!game) notFound();

  // A finished game opens the scorebook only when asked. Its status stays
  // 'final' throughout, so correcting it never puts it back on the public site
  // as a game in progress.
  const isFinal = game.status === 'final';
  const correcting = isFinal && correct === '1';
  const scoring = game.status === 'live' || correcting;

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

      {correcting && (
        <div className="mx-auto max-w-2xl px-4 pt-4">
          <p className="border-l-[3px] border-gold-400 bg-ink-900 px-4 py-3 text-sm leading-relaxed text-steel-300">
            This game is finished. Anything you change here corrects the record — every
            stat re-derives from the plays, and the public page updates with it.
            {game.scoreFromRecorded && (
              <>
                {' '}The score stays at the result already recorded for this game until you
                enter its linescore, inning by inning, on the scoreboard.
              </>
            )}
          </p>
        </div>
      )}

      {scoring ? (
        <Scorebook
          gameId={game.gameId}
          opponentName={game.opponentName}
          homeAway={game.homeAway}
          scheduledInnings={game.scheduledInnings}
          lineup={game.lineup}
          plateAppearances={game.plateAppearances}
          inningRuns={game.inningRuns}
          innings={game.innings}
          stateOverride={game.stateOverride}
          resultTypes={resultTypes}
          roster={roster}
          positions={positions}
          correcting={correcting}
        />
      ) : isFinal ? (
        <FinalGame
          gameId={game.gameId}
          siblings={await getSeriesSiblings(game.gameId, game.seriesKey)}
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
