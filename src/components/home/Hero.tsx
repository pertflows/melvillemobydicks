import Image from 'next/image';
import Link from 'next/link';
import { formatRecord } from '@/lib/format';
import type { TeamRecord } from '@/lib/queries/team';

/**
 * Cinematic opener, art-directed per breakpoint.
 *
 * The squad photograph is portrait (3:4), shot at night: the team occupies
 * 47%-82% of the frame, with empty sky above and infield dirt below. That
 * single asset has to work on a 2.7:1 desktop hero and a 0.46:1 phone screen,
 * which need genuinely different treatments - not just a different crop.
 *
 * Wide viewports keep about a 43% horizontal band of the photo, so the focal
 * point sits at 72%: heads land at 13% of the hero and feet at 95%, putting
 * the whole squad above the headline instead of behind it.
 *
 * Narrow viewports are taller than the source aspect, so object-cover fits the
 * full height and object-position cannot crop the sky at all. Zooming past it
 * would work vertically but crops the squad horizontally - at the zoom needed
 * to clear the sky, only the middle third of the team survives. So on phones
 * the photograph gets its own 4:5 panel, close to its native aspect, where the
 * whole team is visible, and the type sits beneath it and laps slightly over.
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
    <section className="relative isolate overflow-hidden bg-ink-950 sm:flex sm:min-h-[88svh] sm:items-end sm:pb-16">
      {imageUrl && (
        <div className="relative aspect-4/5 w-full sm:absolute sm:inset-0 sm:-z-10 sm:aspect-auto">
          <Image
            src={imageUrl}
            alt="The Melville Moby Dicks squad on the field"
            fill
            priority
            sizes="100vw"
            className="md-settle object-cover object-[50%_58%] opacity-[0.92] sm:object-[50%_72%] sm:opacity-[0.88]"
            {...(imagePlaceholder
              ? { placeholder: 'blur' as const, blurDataURL: imagePlaceholder }
              : {})}
          />

          {/* Fades the panel into the type block below it on phones. */}
          <div
            aria-hidden
            className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-ink-950 to-transparent sm:hidden"
          />
        </div>
      )}

      {/* Wide viewports: bottom-weighted scrim so the type reads over the photo
          without flattening it. Not needed on phones, where they do not overlap. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 hidden sm:block sm:bg-gradient-to-t sm:from-ink-950 sm:via-ink-950/75 sm:via-35% sm:to-transparent sm:to-75%"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 hidden sm:block"
        style={{
          background:
            'radial-gradient(120% 80% at 50% 35%, transparent 40%, rgba(0,11,31,0.5) 100%)',
        }}
      />

      <div className="relative mx-auto -mt-10 w-full max-w-7xl px-gutter pb-12 sm:mt-0 sm:pb-0">
        <p className="type-eyebrow mb-4 text-gold-400 sm:drop-shadow-[0_1px_8px_rgba(0,11,31,0.9)]">
          {seasonName} Season · Melville, New York
        </p>

        <h1 className="type-hero text-white sm:drop-shadow-[0_2px_20px_rgba(0,11,31,0.85)]">
          <span className="block text-[0.42em] tracking-[0.02em] text-steel-200">The Melville</span>
          Moby Dicks
        </h1>

        {/* The one piece of hard data in the hero. */}
        <div className="mt-7 grid grid-cols-2 gap-px bg-white/10 sm:mt-8 sm:flex sm:flex-wrap sm:items-stretch">
          <RecordCell label="Record" value={formatRecord(record.wins, record.losses, record.ties)} accent />
          <RecordCell label="Runs For" value={String(record.runsScored)} />
          <RecordCell label="Runs Against" value={String(record.runsAllowed)} />
          <RecordCell
            label="Run Diff"
            value={`${record.runDifferential >= 0 ? '+' : ''}${record.runDifferential}`}
          />
        </div>

        <div className="mt-7 flex flex-wrap gap-3 sm:mt-8">
          <Link
            href="/roster"
            className="type-eyebrow bg-gold-400 px-6 py-3.5 text-navy-950 transition-colors hover:bg-gold-300"
          >
            View Roster
          </Link>
          <Link
            href="/schedule"
            className="type-eyebrow bg-white/10 px-6 py-3.5 text-white ring-1 ring-inset ring-white/20 backdrop-blur-sm transition-colors hover:bg-white/15"
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
    <div className="flex-1 bg-ink-950/85 px-4 py-3 backdrop-blur-sm sm:px-6 sm:py-4">
      {/* Nowrap so "Runs Against" never wraps and misaligns the row. */}
      <p className="type-eyebrow mb-1.5 whitespace-nowrap text-[10px] text-steel-400">{label}</p>
      <p className={`num-stat-xl ${accent ? 'text-gold-400' : 'text-white'}`}>{value}</p>
    </div>
  );
}
