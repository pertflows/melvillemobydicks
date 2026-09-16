import Image from 'next/image';
import Link from 'next/link';
import { formatRecord } from '@/lib/format';
import type { TeamRecord } from '@/lib/queries/team';

/**
 * Cinematic opener: a full-bleed photograph, a heavy scrim, and the team name
 * set at hero scale with the record as a broadcast strip beneath.
 *
 * The image settles from 1.06 to 1.0 on load (reduced-motion aware via the
 * .md-settle utility), which reads as a camera coming to rest rather than a
 * page animating.
 */
export function Hero({
  record,
  seasonName,
  imageUrl,
  imagePlaceholder,
}: {
  record: TeamRecord;
  seasonName: string;
  imageUrl: string | null;
  imagePlaceholder?: string | null;
}) {
  return (
    <section className="relative isolate flex min-h-[70svh] items-end overflow-hidden bg-navy-950 pb-12 sm:min-h-[78svh] sm:pb-16">
      {imageUrl && (
        <div className="absolute inset-0 -z-10">
          <Image
            src={imageUrl}
            alt=""
            fill
            priority
            sizes="100vw"
            className="md-settle object-cover object-[center_28%] opacity-55"
            {...(imagePlaceholder
              ? { placeholder: 'blur' as const, blurDataURL: imagePlaceholder }
              : {})}
          />
        </div>
      )}

      {/* Layered scrims: vertical for legibility, navy wash for brand temperature. */}
      <div
        aria-hidden
        className="absolute inset-0 -z-10 bg-linear-to-t from-ink-950 via-ink-950/70 to-ink-950/20"
      />
      <div aria-hidden className="absolute inset-0 -z-10 bg-navy-950/40 mix-blend-multiply" />

      <div className="mx-auto w-full max-w-7xl px-gutter">
        <p className="type-eyebrow mb-4 text-gold-400">{seasonName} Season · Melville, New York</p>

        <h1 className="type-hero text-white">
          <span className="block text-[0.42em] tracking-[0.02em] text-steel-300">The Melville</span>
          Moby Dicks
        </h1>

        {/* Record strip: the one piece of hard data in the hero. */}
        <div className="mt-8 flex flex-wrap items-stretch gap-px bg-white/10">
          <RecordCell label="Record" value={formatRecord(record.wins, record.losses, record.ties)} accent />
          <RecordCell label="Runs For" value={String(record.runsScored)} />
          <RecordCell label="Runs Against" value={String(record.runsAllowed)} />
          <RecordCell
            label="Run Diff"
            value={`${record.runDifferential >= 0 ? '+' : ''}${record.runDifferential}`}
          />
        </div>

        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            href="/roster"
            className="type-eyebrow bg-gold-400 px-6 py-3.5 text-navy-950 transition-colors hover:bg-gold-300"
          >
            View Roster
          </Link>
          <Link
            href="/schedule"
            className="type-eyebrow bg-white/10 px-6 py-3.5 text-white ring-1 ring-inset ring-white/20 transition-colors hover:bg-white/15"
          >
            Schedule
          </Link>
        </div>
      </div>
    </section>
  );
}

function RecordCell({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div className="flex-1 bg-ink-950/80 px-4 py-3 backdrop-blur-sm sm:px-6 sm:py-4">
      <p className="type-eyebrow mb-1.5 text-[10px] text-steel-500">{label}</p>
      <p className={`num-stat-xl ${accent ? 'text-gold-400' : 'text-white'}`}>{value}</p>
    </div>
  );
}
