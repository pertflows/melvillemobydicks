import Link from 'next/link';
import { cn } from '@/lib/cn';
import { JerseyNumber } from './JerseyNumber';

/**
 * Leaderboard row: oversized rank numeral sitting behind the content, name,
 * value, and a bar scaled against the category leader. See DESIGN-SYSTEM 4.4.
 */
export function StatBar({
  rank,
  name,
  href,
  jerseyNumber,
  value,
  ratio,
  meta,
  isLeader,
}: {
  rank: number;
  name: string;
  href?: string;
  jerseyNumber?: number | null;
  value: string;
  ratio: number;
  meta?: string;
  isLeader?: boolean;
}) {
  const inner = (
    <div className="group relative overflow-hidden bg-ink-900 px-4 py-3 transition-colors hover:bg-ink-800">
      <span
        aria-hidden
        className="num-base pointer-events-none absolute -right-1 top-1/2 -translate-y-1/2 text-6xl font-extrabold text-steel-700/50 select-none"
        style={{ fontStretch: '70%' }}
      >
        {rank}
      </span>

      <div className="relative flex items-center gap-3">
        <span className="type-eyebrow w-5 shrink-0 text-steel-500 tabular-nums">{rank}</span>
        {jerseyNumber !== undefined && (
          <JerseyNumber value={jerseyNumber} size="sm" tone={isLeader ? 'gold' : 'ghost'} />
        )}

        <div className="min-w-0 flex-1">
          <p className="type-section truncate text-sm text-white">{name}</p>
          {meta && <p className="truncate text-xs text-steel-500">{meta}</p>}
        </div>

        <span
          className={cn(
            'num-base shrink-0 text-lg font-extrabold tabular-nums',
            isLeader ? 'text-gold-400' : 'text-steel-200',
          )}
          style={{ fontStretch: '80%' }}
        >
          {value}
        </span>
      </div>

      <div className="relative mt-2 h-0.5 w-full bg-white/5 transition-all group-hover:h-1">
        <div
          className={cn('h-full transition-all', isLeader ? 'bg-gold-400' : 'bg-navy-600')}
          style={{ width: `${Math.max(2, Math.min(100, ratio * 100))}%` }}
        />
      </div>
    </div>
  );

  return href ? (
    <Link href={href} className="block focus-visible:outline-offset-[-2px]">
      {inner}
    </Link>
  ) : (
    inner
  );
}
