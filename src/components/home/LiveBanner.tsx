import Link from 'next/link';
import { StatusLabel } from '@/components/sports/StatusLabel';
import { formatInning } from '@/lib/format';
import type { GameSummary } from '@/lib/queries/games';

/**
 * Shown on the public site while a game is being scored. The numbers come from
 * the same derived scoreboard the admin sees, so the two never disagree.
 */
export function LiveBanner({
  game,
  inning,
  half,
}: {
  game: GameSummary;
  inning: number | null;
  half: 'top' | 'bottom' | null;
}) {
  return (
    <Link
      href={`/schedule/${game.id}`}
      className="block border-l-[3px] border-live bg-live/10 transition-colors hover:bg-live/15"
    >
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-gutter py-4">
        <div className="flex items-center gap-4">
          <StatusLabel status="live" />
          <span className="type-section text-sm text-white">
            Moby Dicks <span className="num-base mx-1 text-lg">{game.ourRuns ?? 0}</span>
            <span className="text-steel-500">—</span>
            <span className="num-base mx-1 text-lg">{game.theirRuns ?? 0}</span>{' '}
            {game.opponentName}
          </span>
        </div>
        <span className="type-eyebrow text-gold-400">{formatInning(half, inning)}</span>
      </div>
    </Link>
  );
}
