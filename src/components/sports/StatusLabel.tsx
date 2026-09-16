import { cn } from '@/lib/cn';
import type { GameStatus } from '@/lib/queries/games';

/**
 * Broadcast status chips. Colour is never the only signal - each carries a
 * word, so the meaning survives greyscale and colour blindness.
 */
export function StatusLabel({
  status,
  result,
  className,
}: {
  status: GameStatus;
  result?: 'W' | 'L' | 'T' | null;
  className?: string;
}) {
  if (status === 'live') {
    return (
      <span className={cn('type-eyebrow inline-flex items-center gap-2 text-white', className)}>
        <span className="relative flex h-2 w-2">
          <span className="md-live-dot absolute inline-flex h-2 w-2 rounded-full bg-live" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-live" />
        </span>
        Live
      </span>
    );
  }

  if (status === 'final') {
    const tone =
      result === 'W' ? 'text-win' : result === 'L' ? 'text-loss' : 'text-steel-400';
    return (
      <span className={cn('type-eyebrow inline-flex items-center gap-1.5', className)}>
        <span className="text-steel-500">Final</span>
        {result && <span className={tone}>{result}</span>}
      </span>
    );
  }

  if (status === 'postponed' || status === 'cancelled') {
    return (
      <span className={cn('type-eyebrow text-steel-500 line-through', className)}>
        {status === 'postponed' ? 'PPD' : 'CXL'}
      </span>
    );
  }

  if (status === 'pregame') {
    return <span className={cn('type-eyebrow text-gold-400', className)}>Pregame</span>;
  }

  return <span className={cn('type-eyebrow text-steel-500', className)}>Upcoming</span>;
}
