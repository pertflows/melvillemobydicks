import Link from 'next/link';
import { cn } from '@/lib/cn';
import { formatGameDateShort, formatGameTime } from '@/lib/time';
import type { GameSummary } from '@/lib/queries/games';
import { StatusLabel } from './StatusLabel';

/**
 * The horizontal result unit used on the schedule, game pages and home rails.
 *
 * The winning row is full contrast; the losing row drops back to steel. A 3px
 * accent bar runs down the left edge, gold when Melville wins. Zero radius -
 * this is a broadcast strip, not a card. See DESIGN-SYSTEM 4.2.
 */
export function ScoreStrip({
  game,
  href,
  className,
}: {
  game: GameSummary;
  href?: string;
  className?: string;
}) {
  const decided = game.status === 'final' && game.ourRuns !== null && game.theirRuns !== null;
  const weWon = decided && game.ourRuns! > game.theirRuns!;
  const theyWon = decided && game.theirRuns! > game.ourRuns!;

  const accent = !decided
    ? 'bg-steel-700'
    : weWon
      ? 'bg-gold-400'
      : theyWon
        ? 'bg-loss'
        : 'bg-steel-500';

  const body = (
    <div
      className={cn(
        'group relative flex items-stretch bg-ink-900 transition-colors',
        href && 'hover:bg-ink-800',
        className,
      )}
    >
      <div className={cn('w-[3px] shrink-0', accent)} aria-hidden />

      <div className="flex min-w-0 flex-1 items-center gap-4 px-4 py-3.5 sm:px-5">
        <div className="min-w-0 flex-1 space-y-1.5">
          <TeamRow
            name="Moby Dicks"
            runs={game.ourRuns}
            dim={decided && !weWon}
            showScore={decided}
          />
          <TeamRow
            name={game.opponentName ?? 'TBD'}
            runs={game.theirRuns}
            dim={decided && !theyWon}
            showScore={decided}
          />
        </div>

        <div className="flex shrink-0 flex-col items-end gap-1.5 text-right">
          <StatusLabel status={game.status} result={game.result} />
          <time
            dateTime={game.startsAt}
            className="text-[11px] tracking-wide text-steel-500 tabular-nums"
          >
            {formatGameDateShort(game.startsAt)}
            {!decided && <> · {formatGameTime(game.startsAt)}</>}
          </time>
          {game.gameNumber > 1 && (
            <span className="type-eyebrow text-[10px] text-steel-600">Game {game.gameNumber}</span>
          )}
        </div>
      </div>
    </div>
  );

  if (!href) return body;

  return (
    <Link href={href} className="block focus-visible:outline-offset-[-2px]">
      {body}
    </Link>
  );
}

function TeamRow({
  name,
  runs,
  dim,
  showScore,
}: {
  name: string;
  runs: number | null;
  dim: boolean;
  showScore: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span
        className={cn(
          'type-section truncate text-[0.9375rem] sm:text-base',
          dim ? 'text-steel-400' : 'text-white',
        )}
      >
        {name}
      </span>
      {showScore && (
        <span
          className={cn(
            'num-base shrink-0 text-xl font-extrabold tabular-nums sm:text-2xl',
            dim ? 'text-steel-400' : 'text-white',
          )}
          style={{ fontStretch: '80%' }}
        >
          {runs}
        </span>
      )}
    </div>
  );
}
