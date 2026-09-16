import type { Metadata } from 'next';
import { PageHeader } from '@/components/site/PageHeader';
import { getCurrentSeason } from '@/lib/queries/seasons';
import { getSeasonLeaderboard } from '@/lib/queries/stats';
import { StatsTable } from './StatsTable';

export const revalidate = 60;

export const metadata: Metadata = {
  title: 'Statistics',
  description: 'Season batting statistics for the Melville Moby Dicks.',
};

export default async function StatsPage() {
  const season = await getCurrentSeason();
  if (!season) return null;

  const rows = await getSeasonLeaderboard(season.id);
  const inherited = rows.filter((r) => r.avgBasis === 'legacy_override').length;

  return (
    <>
      <PageHeader
        eyebrow={`${season.name} Season`}
        title="Statistics"
        lede="Season batting. Every number here is computed, never typed in."
        stat={{ label: 'Qualified', value: rows.length }}
      />

      <div className="mx-auto max-w-7xl px-gutter py-section">
        <StatsTable rows={rows} />

        {inherited > 0 && (
          <div className="mt-block max-w-2xl border-l-[3px] border-steel-700 pl-5">
            <h2 className="type-eyebrow mb-2 text-steel-400">About these numbers</h2>
            <p className="text-sm leading-relaxed text-steel-500">
              {inherited} of {rows.length} season lines are carried over from the previous
              site, which published averages without the at-bat totals behind them. Those
              at-bats are recorded as unknown rather than being reverse-engineered from the
              average, so on-base and slugging are left blank rather than guessed. Games
              scored in the app compute every stat from individual plate appearances.
            </p>
          </div>
        )}
      </div>
    </>
  );
}
