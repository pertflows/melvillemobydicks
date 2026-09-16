import Link from 'next/link';
import { formatRate } from '@/lib/format';
import { formatGameDateShort } from '@/lib/time';
import { cn } from '@/lib/cn';
import { JerseyNumber } from './JerseyNumber';
import { PlayerPortrait } from './PlayerPortrait';

/**
 * Player of the Game - the site's signature graphic.
 *
 * The one place the system goes maximal: full-bleed portrait, gold rule, the
 * award in eyebrow gold, name at display size, and three headline stats.
 * See DESIGN-SYSTEM 4.6.
 */
export function PotgCard({
  playerSlug,
  displayName,
  jerseyNumber,
  positionLabel,
  photoUrl,
  photoPlaceholder,
  battingAverageDisplay,
  homeRuns,
  rbi,
  opponentName,
  date,
  className,
}: {
  playerSlug: string;
  displayName: string;
  jerseyNumber: number | null;
  positionLabel: string | null;
  photoUrl: string | null;
  photoPlaceholder?: string | null;
  battingAverageDisplay: number | null;
  homeRuns: number;
  rbi: number;
  opponentName?: string | null;
  date?: string | null;
  className?: string;
}) {
  return (
    <article className={cn('group relative overflow-hidden bg-navy-900', className)}>
      <div className="absolute inset-x-0 top-0 h-[3px] bg-gold-400" aria-hidden />

      <div className="grid sm:grid-cols-[minmax(0,13rem)_1fr]">
        <div className="relative aspect-4/5 sm:aspect-auto sm:min-h-[22rem]">
          <PlayerPortrait
            src={photoUrl}
            alt={displayName}
            jerseyNumber={jerseyNumber}
            placeholder={photoPlaceholder}
            sizes="(max-width: 640px) 100vw, 208px"
            className="absolute inset-0"
          />
          <div className="photo-scrim absolute inset-0 sm:bg-none" aria-hidden />
        </div>

        <div className="relative flex flex-col justify-center gap-5 p-6 sm:p-8">
          <div>
            <p className="type-eyebrow mb-3 text-gold-400">★ Player of the Game</p>

            <div className="flex items-start gap-3">
              <JerseyNumber value={jerseyNumber} size="lg" tone="gold" />
              <div className="min-w-0">
                <h3 className="type-display text-[clamp(1.75rem,4.5vw,2.75rem)] text-white">
                  <Link href={`/roster/${playerSlug}`} className="hover:text-gold-200">
                    {displayName}
                  </Link>
                </h3>
                {positionLabel && (
                  <p className="type-eyebrow mt-1.5 text-steel-400">{positionLabel}</p>
                )}
              </div>
            </div>
          </div>

          <dl className="grid grid-cols-3 gap-px bg-white/10">
            <Stat label="AVG" value={formatRate(battingAverageDisplay)} />
            <Stat label="HR" value={String(homeRuns)} />
            <Stat label="RBI" value={String(rbi)} />
          </dl>

          {(opponentName || date) && (
            <p className="type-eyebrow text-steel-500">
              {opponentName && <>vs {opponentName}</>}
              {opponentName && date && <> · </>}
              {date && formatGameDateShort(date)}
            </p>
          )}
        </div>
      </div>
    </article>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-navy-900 px-3 py-3">
      <dt className="type-eyebrow mb-1.5 text-[10px] text-steel-500">{label}</dt>
      <dd className="num-stat-xl text-white">{value}</dd>
    </div>
  );
}
