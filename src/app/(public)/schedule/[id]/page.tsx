import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { PotgCard } from '@/components/sports/PotgCard';
import { SectionHeading } from '@/components/sports/SectionHeading';
import { StatusLabel } from '@/components/sports/StatusLabel';
import { getGameById } from '@/lib/queries/games';
import { formatGameDateLong, formatGameTime } from '@/lib/time';

export const revalidate = 60;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const game = await getGameById(id);
  if (!game) return {};

  const score =
    game.status === 'final' ? ` ${game.ourRuns}-${game.theirRuns}` : '';
  return {
    title: `vs ${game.opponentName ?? 'TBD'}${score}`,
    description: `${formatGameDateLong(game.startsAt)} at ${game.venueName ?? 'TBD'}.`,
  };
}

export default async function GamePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const game = await getGameById(id);
  if (!game) notFound();

  const decided = game.status === 'final' && game.ourRuns !== null && game.theirRuns !== null;
  const weWon = decided && game.ourRuns! > game.theirRuns!;

  return (
    <>
      {/* -- matchup graphic ------------------------------------------------ */}
      <header className="hairline-b bg-navy-950">
        <div className="mx-auto max-w-5xl px-gutter pb-block pt-10 sm:pt-14">
          <Link href="/schedule" className="type-eyebrow mb-8 inline-block whitespace-nowrap text-steel-500 hover:text-white">
            ← Schedule
          </Link>

          <p className="type-eyebrow mb-6 text-gold-400">
            {formatGameDateLong(game.startsAt)} · {formatGameTime(game.startsAt)}
            {game.gameNumber > 1 && <> · Game {game.gameNumber}</>}
          </p>

          <div className="grid gap-px bg-white/10 sm:grid-cols-[1fr_auto_1fr]">
            <TeamPanel name="Moby Dicks" runs={game.ourRuns} dim={decided && !weWon} show={decided} />

            <div className="flex items-center justify-center bg-ink-950 px-6 py-4">
              <StatusLabel status={game.status} result={game.result} />
            </div>

            <TeamPanel
              name={game.opponentName ?? 'TBD'}
              runs={game.theirRuns}
              dim={decided && weWon}
              show={decided}
              align="right"
            />
          </div>

          <p className="mt-5 text-sm text-steel-400">
            {game.venueName}
            {game.isMercy && <> · Mercy rule</>}
          </p>
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-gutter py-section">
        {/* -- linescore, when the game was scored in-app ------------------- */}
        {game.innings.length > 0 && (
          <section className="mb-section">
            <SectionHeading eyebrow="By inning" title="Linescore" />
            <div className="overflow-x-auto">
              <table className="w-full min-w-md border-collapse">
                <caption className="sr-only">Runs by inning</caption>
                <thead>
                  <tr className="hairline-b">
                    <th scope="col" className="type-eyebrow px-3 py-2 text-left text-steel-500">Team</th>
                    {game.innings.map((i) => (
                      <th key={i.inning} scope="col" className="type-eyebrow px-3 py-2 text-steel-500">
                        {i.inning}
                      </th>
                    ))}
                    <th scope="col" className="type-eyebrow px-3 py-2 text-gold-400">R</th>
                  </tr>
                </thead>
                <tbody>
                  <LinescoreRow name="Moby Dicks" values={game.innings.map((i) => i.ourRuns)} total={game.ourRuns} />
                  <LinescoreRow name={game.opponentName ?? 'Opponent'} values={game.innings.map((i) => i.theirRuns)} total={game.theirRuns} />
                </tbody>
              </table>
            </div>
          </section>
        )}

        {game.potg && (
          <section className="mb-section">
            <SectionHeading eyebrow="Honours" title="Player of the Game" />
            <PotgCard
              playerSlug={game.potg.playerSlug}
              displayName={game.potg.displayName}
              jerseyNumber={game.potg.jerseyNumber}
              positionLabel={game.potg.positionLabel}
              photoUrl={game.potg.photoUrl}
              photoPlaceholder={game.potg.photoPlaceholder}
              battingAverageDisplay={game.potg.battingAverageDisplay}
              homeRuns={game.potg.homeRuns}
              rbi={game.potg.rbi}
            />
          </section>
        )}

        {game.post && (
          <section className="mb-section">
            <SectionHeading eyebrow="Dispatch" title="Captain's Log" />
            <Link href={`/captains-log/${game.post.slug}`} className="block bg-navy-900 p-6 transition-colors hover:bg-navy-800 sm:p-8">
              <h3 className="type-section text-white">{game.post.title}</h3>
              {game.post.excerpt && (
                <p className="type-editorial mt-4 max-w-[68ch] text-steel-300 line-clamp-3">
                  {game.post.excerpt}
                </p>
              )}
              <p className="type-eyebrow mt-5 text-steel-400">Read entry →</p>
            </Link>
          </section>
        )}

        {game.photos.length > 0 && (
          <section>
            <SectionHeading eyebrow="From the diamond" title="Photos" />
            <div className="grid gap-px bg-white/5 sm:grid-cols-2">
              {game.photos.map((p) => (
                <figure key={p.id} className="bg-ink-900">
                  {p.url && (
                    <div className="relative aspect-video">
                      <Image
                        src={p.url}
                        alt={p.caption ?? ''}
                        fill
                        sizes="(max-width: 640px) 100vw, 50vw"
                        className="object-cover"
                        {...(p.placeholder ? { placeholder: 'blur' as const, blurDataURL: p.placeholder } : {})}
                      />
                    </div>
                  )}
                  {p.caption && (
                    <figcaption className="px-4 py-3 text-sm text-steel-400">{p.caption}</figcaption>
                  )}
                </figure>
              ))}
            </div>
          </section>
        )}

        {game.notes && (
          <p className="mt-section border-l-[3px] border-steel-700 pl-4 text-xs text-steel-500">
            {game.notes}
          </p>
        )}
      </div>
    </>
  );
}

function TeamPanel({
  name,
  runs,
  dim,
  show,
  align = 'left',
}: {
  name: string;
  runs: number | null;
  dim: boolean;
  show: boolean;
  align?: 'left' | 'right';
}) {
  return (
    <div className={`bg-ink-950 px-6 py-8 ${align === 'right' ? 'sm:text-right' : ''}`}>
      <p className={`type-section text-lg ${dim ? 'text-steel-400' : 'text-white'}`}>{name}</p>
      {show && (
        <p className={`num-scoreboard mt-3 ${dim ? 'text-steel-400' : 'text-white'}`}>{runs}</p>
      )}
    </div>
  );
}

function LinescoreRow({
  name,
  values,
  total,
}: {
  name: string;
  values: number[];
  total: number | null;
}) {
  return (
    <tr className="hairline-b">
      <th scope="row" className="type-section px-3 py-3 text-left text-sm text-white">
        {name}
      </th>
      {values.map((v, i) => (
        <td key={i} className="num-table px-3 py-3 text-center text-steel-300">
          {v}
        </td>
      ))}
      <td className="num-table px-3 py-3 text-center font-bold text-gold-400">{total}</td>
    </tr>
  );
}
