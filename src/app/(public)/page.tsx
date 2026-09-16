import Link from 'next/link';
import { Hero } from '@/components/home/Hero';
import { ScoreStrip } from '@/components/sports/ScoreStrip';
import { PotgCard } from '@/components/sports/PotgCard';
import { SectionHeading } from '@/components/sports/SectionHeading';
import { StatBar } from '@/components/sports/StatBar';
import { Reveal } from '@/components/sports/Reveal';
import { NumberTicker } from '@/components/sports/NumberTicker';
import { getCurrentSeason } from '@/lib/queries/seasons';
import { getTeamRecord } from '@/lib/queries/team';
import { getRecentResults, getUpcomingGames } from '@/lib/queries/games';
import { getSeasonLeaderboard } from '@/lib/queries/stats';
import { topLeaders, type LeaderRow } from '@/lib/stats/leaders';
import { getGallery, getPosts, getRecentAwards, getSponsors } from '@/lib/queries/content';
import { formatRate } from '@/lib/format';
import { formatGameDateLong, formatGameTime } from '@/lib/time';

export const revalidate = 60;

export default async function HomePage() {
  const season = await getCurrentSeason();
  if (!season) return <EmptyState />;

  const [record, upcoming, results, leaders, awards, posts, gallery, sponsors] =
    await Promise.all([
      getTeamRecord(season.id),
      getUpcomingGames(season.id, 4),
      getRecentResults(season.id, 4),
      getSeasonLeaderboard(season.id),
      getRecentAwards(season.id, 4),
      getPosts(1),
      getGallery(),
      getSponsors(),
    ]);

  const hero = gallery[0] ?? null;
  const potg = awards[0] ?? null;
  const nextGame = upcoming[0] ?? null;
  const latestPost = posts[0] ?? null;

  return (
    <>
      <Hero
        record={record}
        seasonName={season.name}
        imageUrl={hero?.url ?? null}
        imagePlaceholder={hero?.placeholder}
      />

      {/* -- next game feature --------------------------------------------- */}
      {nextGame && (
        <section className="hairline-b bg-navy-900">
          <div className="mx-auto max-w-7xl px-gutter py-block">
            <Link href={`/schedule/${nextGame.id}`} className="group block">
              <div className="flex flex-wrap items-end justify-between gap-6">
                <div className="min-w-0">
                  <p className="type-eyebrow mb-3 text-gold-400">
                    Next Game · {formatGameDateLong(nextGame.startsAt)} · {formatGameTime(nextGame.startsAt)}
                  </p>
                  <p className="type-display text-[clamp(1.75rem,5.5vw,3.5rem)] text-white">
                    vs {nextGame.opponentName ?? 'TBD'}
                  </p>
                  <p className="mt-3 text-sm text-steel-400">
                    {nextGame.venueName}
                    {nextGame.gameNumber > 1 && (
                      <> · Game {nextGame.gameNumber} of a doubleheader</>
                    )}
                  </p>
                </div>
                <span className="type-eyebrow shrink-0 bg-white/10 px-5 py-3 text-white ring-1 ring-inset ring-white/20 transition-colors group-hover:bg-white/15">
                  Game details →
                </span>
              </div>
            </Link>
          </div>
        </section>
      )}

      {/* -- upcoming + recent results -------------------------------------- */}
      <section className="mx-auto max-w-7xl px-gutter py-section">
        <div className="grid gap-block lg:grid-cols-2">
          <div>
            <SectionHeading eyebrow="Ahead" title="Upcoming" href="/schedule" linkLabel="Full schedule" />
            <div className="flex flex-col gap-px bg-white/5">
              {upcoming.length > 0 ? (
                upcoming.map((g, i) => (
                  <Reveal key={g.id} delay={i * 0.05}>
                    <ScoreStrip game={g} href={`/schedule/${g.id}`} />
                  </Reveal>
                ))
              ) : (
                <p className="bg-ink-900 px-5 py-6 text-sm text-steel-400">
                  No games scheduled. Check back for next season.
                </p>
              )}
            </div>
          </div>

          <div>
            <SectionHeading eyebrow="Results" title="Recent Games" href="/schedule" />
            <div className="flex flex-col gap-px bg-white/5">
              {results.map((g, i) => (
                <Reveal key={g.id} delay={i * 0.05}>
                  <ScoreStrip game={g} href={`/schedule/${g.id}`} />
                </Reveal>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* -- player of the game -------------------------------------------- */}
      {potg && (
        <section className="bg-navy-950/60 py-section">
          <div className="mx-auto max-w-7xl px-gutter">
            <SectionHeading eyebrow="Honours" title="Player of the Game" />
            <Reveal>
              <PotgCard
                playerSlug={potg.playerSlug}
                displayName={potg.displayName}
                jerseyNumber={potg.jerseyNumber}
                positionLabel={potg.positionLabel}
                photoUrl={potg.photoUrl}
                photoPlaceholder={potg.photoPlaceholder}
                battingAverageDisplay={potg.battingAverageDisplay}
                homeRuns={potg.homeRuns}
                rbi={potg.rbi}
                opponentName={potg.opponentName}
                date={potg.awardedOn}
              />
            </Reveal>

            {awards.length > 1 && (
              <div className="mt-px grid gap-px bg-white/10 sm:grid-cols-3">
                {awards.slice(1).map((a) => (
                  <Link
                    key={a.id}
                    href={`/roster/${a.playerSlug}`}
                    className="bg-ink-900 px-5 py-4 transition-colors hover:bg-ink-800"
                  >
                    <p className="type-eyebrow mb-1.5 text-gold-400">★ Player of the Game</p>
                    <p className="type-section text-sm text-white">{a.displayName}</p>
                    <p className="mt-1 text-xs text-steel-500">
                      {a.opponentName ? `vs ${a.opponentName}` : ''}
                    </p>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </section>
      )}

      {/* -- leaders -------------------------------------------------------- */}
      <section className="mx-auto max-w-7xl px-gutter py-section">
        <SectionHeading eyebrow={`${season.name} season`} title="Team Leaders" href="/stats" linkLabel="All statistics" />

        <div className="grid gap-block md:grid-cols-3">
          <LeaderRail title="Batting Average" rows={topLeaders(leaders, 'batting_average')} render={(r) => formatRate(r.battingAverageDisplay)} valueOf={(r) => r.battingAverageDisplay ?? 0} />
          <LeaderRail title="Home Runs" rows={topLeaders(leaders, 'home_runs')} render={(r) => String(r.homeRuns)} valueOf={(r) => r.homeRuns} />
          <LeaderRail title="RBI" rows={topLeaders(leaders, 'rbi')} render={(r) => String(r.rbi)} valueOf={(r) => r.rbi} />
        </div>
      </section>

      {/* -- season totals -------------------------------------------------- */}
      <section className="hairline-t hairline-b bg-ink-900">
        <div className="mx-auto grid max-w-7xl grid-cols-2 gap-px bg-white/5 sm:grid-cols-4">
          <TotalCell label="Games Played" value={record.gamesPlayed} />
          <TotalCell label="Runs Scored" value={record.runsScored} />
          <TotalCell label="Home Runs" value={leaders.reduce((a, r) => a + r.homeRuns, 0)} />
          <TotalCell label="Hits" value={leaders.reduce((a, r) => a + r.hits, 0)} />
        </div>
      </section>

      {/* -- captain's log -------------------------------------------------- */}
      {latestPost && (
        <section className="mx-auto max-w-7xl px-gutter py-section">
          <SectionHeading eyebrow="Dispatch" title="Captain's Log" href="/captains-log" linkLabel="All entries" />

          <Reveal>
            <Link href={`/captains-log/${latestPost.slug}`} className="group block bg-navy-900 p-6 transition-colors hover:bg-navy-800 sm:p-10">
              <p className="type-eyebrow mb-4 text-gold-400">
                {latestPost.publishedAt && formatGameDateLong(latestPost.publishedAt)}
                {latestPost.authorName && <> · {latestPost.authorName}</>}
              </p>
              <h3 className="type-display max-w-3xl text-[clamp(1.5rem,4vw,2.5rem)] text-white">
                {latestPost.title}
              </h3>
              <p className="type-editorial mt-5 max-w-2xl text-steel-300 line-clamp-3">
                {latestPost.paragraphs[0]}
              </p>
              <p className="type-eyebrow mt-6 text-steel-400 group-hover:text-white">Read entry →</p>
            </Link>
          </Reveal>
        </section>
      )}

      {/* -- sponsors ------------------------------------------------------- */}
      {sponsors.length > 0 && (
        <section className="mx-auto max-w-7xl px-gutter pb-section">
          <SectionHeading eyebrow="Support" title="Our Sponsors" href="/sponsors" />
          <div className="flex flex-wrap items-center gap-x-10 gap-y-6">
            {sponsors.map((s) => (
              <span key={s.id} className="type-section text-sm text-steel-500 transition-colors hover:text-steel-300">
                {s.name}
              </span>
            ))}
          </div>
        </section>
      )}
    </>
  );
}

function LeaderRail({
  title,
  rows,
  render,
  valueOf,
}: {
  title: string;
  rows: LeaderRow[];
  render: (r: LeaderRow) => string;
  valueOf: (r: LeaderRow) => number;
}) {
  const max = Math.max(...rows.map(valueOf), 1);

  return (
    <div>
      <h3 className="type-eyebrow mb-3 text-steel-400">{title}</h3>
      <div className="flex flex-col gap-px bg-white/5">
        {rows.map((r, i) => (
          <StatBar
            key={r.playerId}
            rank={i + 1}
            name={r.displayName}
            href={`/roster/${r.slug}`}
            jerseyNumber={r.jerseyNumber}
            value={render(r)}
            ratio={valueOf(r) / max}
            meta={r.positionLabel ?? undefined}
            isLeader={i === 0}
          />
        ))}
      </div>
    </div>
  );
}

function TotalCell({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-ink-900 px-gutter py-10 text-center">
      <p className="type-eyebrow mb-3 text-steel-500">{label}</p>
      <NumberTicker value={value} className="num-scoreboard block text-white" />
    </div>
  );
}

function EmptyState() {
  return (
    <div className="mx-auto max-w-2xl px-gutter py-section text-center">
      <h1 className="type-display text-white">No season yet</h1>
      <p className="mt-4 text-steel-400">
        Create a season in the admin area to get started.
      </p>
    </div>
  );
}
