import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { PlayerPortrait } from '@/components/sports/PlayerPortrait';
import { JerseyNumber, JerseyWatermark } from '@/components/sports/JerseyNumber';
import { SectionHeading } from '@/components/sports/SectionHeading';
import { StatusLabel } from '@/components/sports/StatusLabel';
import { NumberTicker } from '@/components/sports/NumberTicker';
import { getCurrentSeason } from '@/lib/queries/seasons';
import { getPlayerBySlug, getPlayerSlugs } from '@/lib/queries/players';
import { formatRate, formatScore } from '@/lib/format';
import { formatGameDateLong } from '@/lib/time';

export const revalidate = 60;

export async function generateStaticParams() {
  return (await getPlayerSlugs()).map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const season = await getCurrentSeason();
  if (!season) return {};
  const player = await getPlayerBySlug(slug, season.id);
  if (!player) return {};

  return {
    title: player.displayName,
    description:
      player.bioParagraphs[0]?.slice(0, 160) ??
      `${player.displayName}, ${player.positionLabel ?? 'player'} for the Melville Moby Dicks.`,
    openGraph: player.photoUrl ? { images: [{ url: player.photoUrl }] } : undefined,
  };
}

export default async function PlayerPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const season = await getCurrentSeason();
  if (!season) notFound();

  const player = await getPlayerBySlug(slug, season.id);
  if (!player) notFound();

  const s = player.stats;

  return (
    <>
      {/* -- lower third: the broadcast name plate ------------------------- */}
      <header className="relative overflow-hidden bg-navy-950">
        <JerseyWatermark
          value={player.jerseyNumber}
          className="-right-6 top-1/2 -translate-y-1/2"
        />

        <div className="relative mx-auto grid max-w-7xl gap-8 px-gutter pb-block pt-10 sm:pt-14 md:grid-cols-[minmax(0,22rem)_1fr] md:items-end">
          <div className="relative aspect-4/5 w-full max-w-sm">
            <PlayerPortrait
              src={player.photoUrl}
              alt={player.displayName}
              jerseyNumber={player.jerseyNumber}
              placeholder={player.photoPlaceholder}
              priority
              sizes="(max-width: 768px) 100vw, 352px"
              className="absolute inset-0"
            />
            <div className="absolute inset-x-0 bottom-0 h-[3px] bg-gold-400" aria-hidden />
          </div>

          <div className="pb-2">
            <Link href="/roster" className="type-eyebrow mb-6 inline-block whitespace-nowrap text-steel-500 hover:text-white">
              ← Roster
            </Link>

            <div className="flex items-start gap-4">
              <JerseyNumber value={player.jerseyNumber} size="xl" tone="gold" className="hidden sm:inline-flex" />
              <div className="min-w-0">
                <p className="type-eyebrow mb-2 text-gold-400">{player.positionLabel}</p>
                <h1 className="type-display text-white">{player.displayName}</h1>
              </div>
            </div>

            {player.awardCount > 0 && (
              <p className="type-eyebrow mt-5 text-steel-400">
                ★ Player of the Game — {player.awardCount}{' '}
                {player.awardCount === 1 ? 'time' : 'times'}
              </p>
            )}
          </div>
        </div>
      </header>

      {/* -- season line ---------------------------------------------------- */}
      <section className="hairline-b hairline-t bg-ink-900">
        <div className="mx-auto max-w-7xl">
          <h2 className="sr-only">{season.name} season statistics</h2>
          <dl className="grid grid-cols-3 gap-px bg-white/5 sm:grid-cols-6">
            <StatCell label="AVG" value={formatRate(s?.battingAverageDisplay ?? null)} accent />
            <StatCell label="HR" value={s?.homeRuns ?? 0} />
            <StatCell label="RBI" value={s?.rbi ?? 0} />
            <StatCell label="H" value={s?.hits ?? 0} />
            <StatCell label="BB" value={s?.walks ?? 0} />
            <StatCell label="G" value={s?.games ?? 0} />
          </dl>
        </div>
      </section>

      {/* Honest about inherited numbers rather than presenting them as computed. */}
      {s?.avgBasis === 'legacy_override' && (
        <p className="mx-auto max-w-7xl px-gutter pt-4 text-xs text-steel-500">
          Season averages carried over from the previous site, which published rate stats
          without the at-bat totals behind them. Games scored in-app compute AVG, OBP, SLG
          and OPS from individual plate appearances.
        </p>
      )}

      <div className="mx-auto grid max-w-7xl gap-block px-gutter py-section lg:grid-cols-[1.4fr_1fr]">
        {/* -- biography, exactly as written --------------------------------- */}
        {player.bioParagraphs.length > 0 && (
          <section className="min-w-0">
            <SectionHeading eyebrow="Scouting report" title="Biography" />
            <div className="space-y-5">
              {player.bioParagraphs.map((p, i) => (
                <p key={i} className="type-editorial max-w-[68ch] break-words text-steel-300">
                  {p}
                </p>
              ))}
            </div>
          </section>
        )}

        {/* -- award history --------------------------------------------------- */}
        {player.awards.length > 0 && (
          <section className="min-w-0">
            <SectionHeading eyebrow="Honours" title="Player of the Game" />
            <ol className="flex flex-col gap-px bg-white/5">
              {player.awards.map((a) => (
                <li key={a.id}>
                  <Link
                    href={a.gameId ? `/schedule/${a.gameId}` : '#'}
                    className="flex items-center justify-between gap-4 bg-ink-900 px-4 py-3.5 transition-colors hover:bg-ink-800"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="type-section truncate text-sm text-white">
                        vs {a.opponentName ?? 'Unknown'}
                      </p>
                      <p className="mt-1 truncate text-xs text-steel-500">
                        {a.startsAt && formatGameDateLong(a.startsAt)}
                        {a.venueName && <> · {a.venueName}</>}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-3">
                      <span className="num-table text-white">
                        {formatScore(a.ourRuns, a.theirRuns)}
                      </span>
                      <StatusLabel status="final" result={a.result as 'W' | 'L' | 'T' | null} />
                    </div>
                  </Link>
                </li>
              ))}
            </ol>
          </section>
        )}
      </div>
    </>
  );
}

function StatCell({
  label,
  value,
  accent,
}: {
  label: string;
  value: string | number;
  accent?: boolean;
}) {
  const numeric = typeof value === 'number';

  return (
    <div className="bg-ink-900 px-4 py-6 text-center">
      <dt className="type-eyebrow mb-2 text-[10px] text-steel-500">{label}</dt>
      <dd className={`num-stat-xl ${accent ? 'text-gold-400' : 'text-white'}`}>
        {numeric ? <NumberTicker value={value} /> : value}
      </dd>
    </div>
  );
}
