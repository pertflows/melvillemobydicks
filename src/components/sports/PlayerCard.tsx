import Link from 'next/link';
import { formatRate } from '@/lib/format';
import { JerseyNumber } from './JerseyNumber';
import { PlayerPortrait } from './PlayerPortrait';
import type { RosterPlayer } from '@/lib/queries/players';

/**
 * Roster card: portrait, number block overlapping the image edge, and three
 * headline stats. The number sits ON the photo boundary so the card reads as a
 * composed graphic rather than an image stacked above text.
 */
export function PlayerCard({ player, priority }: { player: RosterPlayer; priority?: boolean }) {
  const s = player.stats;

  return (
    <Link
      href={`/roster/${player.slug}`}
      className="group relative block bg-ink-900 transition-colors hover:bg-ink-800"
    >
      <div className="relative aspect-4/5 overflow-hidden">
        <PlayerPortrait
          src={player.photoUrl}
          alt={player.displayName}
          jerseyNumber={player.jerseyNumber}
          placeholder={player.photoPlaceholder}
          priority={priority}
          sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 260px"
          className="absolute inset-0 transition-transform duration-500 group-hover:scale-[1.03]"
        />
        <div className="photo-scrim absolute inset-0" aria-hidden />

        {player.awardCount > 0 && (
          <span className="type-eyebrow absolute right-0 top-0 bg-gold-400 px-2 py-1 text-[10px] text-navy-950">
            ★ {player.awardCount}
          </span>
        )}

        <div className="absolute inset-x-0 bottom-0 flex items-end gap-2.5 p-3">
          <JerseyNumber value={player.jerseyNumber} size="md" tone="gold" />
          <div className="min-w-0 pb-0.5">
            {/* Wrap rather than truncate - several players have long surnames. */}
            <p className="type-section text-sm leading-[1.05] text-white">
              {player.displayName}
            </p>
            <p className="type-eyebrow mt-1 text-[10px] leading-tight text-steel-300">
              {player.positionLabel}
            </p>
          </div>
        </div>
      </div>

      <dl className="grid grid-cols-3 gap-px bg-white/5">
        <Cell label="AVG" value={formatRate(s?.battingAverageDisplay ?? null)} />
        <Cell label="HR" value={String(s?.homeRuns ?? 0)} />
        <Cell label="RBI" value={String(s?.rbi ?? 0)} />
      </dl>
    </Link>
  );
}

function Cell({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-ink-900 px-2 py-2.5 text-center">
      <dt className="type-eyebrow mb-1 text-[9px] text-steel-500">{label}</dt>
      <dd className="num-table text-white">{value}</dd>
    </div>
  );
}
