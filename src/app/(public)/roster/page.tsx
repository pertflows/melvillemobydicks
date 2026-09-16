import type { Metadata } from 'next';
import { PlayerCard } from '@/components/sports/PlayerCard';
import { PageHeader } from '@/components/site/PageHeader';
import { Reveal } from '@/components/sports/Reveal';
import { getCurrentSeason } from '@/lib/queries/seasons';
import { getRoster } from '@/lib/queries/players';

export const revalidate = 60;

export const metadata: Metadata = {
  title: 'Roster',
  description: 'The Melville Moby Dicks roster: players, numbers, positions and season statistics.',
};

export default async function RosterPage() {
  const season = await getCurrentSeason();
  const players = season ? await getRoster(season.id) : [];

  const active = players.filter((p) => p.status === 'active');
  const others = players.filter((p) => p.status !== 'active');

  return (
    <>
      <PageHeader
        eyebrow={season ? `${season.name} Season` : undefined}
        title="Roster"
        lede="Every whale on the wall."
        stat={{ label: 'Players', value: active.length }}
      />

      <div className="mx-auto max-w-7xl px-gutter pb-section">
        <div className="grid grid-cols-2 gap-px bg-white/5 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {active.map((p, i) => (
            <Reveal key={p.id} delay={Math.min(i, 8) * 0.04}>
              <PlayerCard player={p} priority={i < 5} />
            </Reveal>
          ))}
        </div>

        {others.length > 0 && (
          <section className="mt-section">
            <h2 className="type-section mb-6 text-white">Inactive &amp; Alumni</h2>
            <div className="grid grid-cols-2 gap-px bg-white/5 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
              {others.map((p) => (
                <PlayerCard key={p.id} player={p} />
              ))}
            </div>
          </section>
        )}
      </div>
    </>
  );
}
