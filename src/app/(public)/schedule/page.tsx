import type { Metadata } from 'next';
import { PageHeader } from '@/components/site/PageHeader';
import { ScoreStrip } from '@/components/sports/ScoreStrip';
import { formatRecord } from '@/lib/format';
import { formatGameDateWithDay } from '@/lib/time';
import { getCurrentSeason } from '@/lib/queries/seasons';
import { getSchedule } from '@/lib/queries/games';
import { getTeamRecord } from '@/lib/queries/team';

export const revalidate = 60;

export const metadata: Metadata = {
  title: 'Schedule',
  description: 'Melville Moby Dicks schedule, results and upcoming games.',
};

export default async function SchedulePage() {
  const season = await getCurrentSeason();
  if (!season) return null;

  const [games, record] = await Promise.all([
    getSchedule(season.id),
    getTeamRecord(season.id),
  ]);

  // Group by calendar date so doubleheaders read as one evening.
  const byDate = new Map<string, typeof games>();
  for (const g of games) {
    const key = formatGameDateWithDay(g.startsAt);
    byDate.set(key, [...(byDate.get(key) ?? []), g]);
  }

  return (
    <>
      <PageHeader
        eyebrow={`${season.name} Season`}
        title="Schedule"
        lede="Every whale has its day."
        stat={{ label: 'Record', value: formatRecord(record.wins, record.losses, record.ties) }}
      >
        <div className="mt-8 grid grid-cols-3 gap-px bg-white/10 sm:max-w-md">
          <Mini label="Wins" value={record.wins} />
          <Mini label="Losses" value={record.losses} />
          <Mini label="Ties" value={record.ties} />
        </div>
      </PageHeader>

      <div className="mx-auto max-w-5xl px-gutter py-section">
        {[...byDate.entries()].map(([date, dayGames]) => (
          <section key={date} className="mb-block last:mb-0">
            <h2 className="type-eyebrow mb-3 text-steel-500">
              {date}
              {dayGames.length > 1 && (
                <span className="ml-2 text-steel-600">· Doubleheader</span>
              )}
            </h2>
            <div className="flex flex-col gap-px bg-white/5">
              {dayGames.map((g) => (
                <ScoreStrip key={g.id} game={g} href={`/schedule/${g.id}`} />
              ))}
            </div>
          </section>
        ))}
      </div>
    </>
  );
}

function Mini({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-ink-900 px-4 py-3">
      <p className="type-eyebrow mb-1.5 text-[10px] text-steel-500">{label}</p>
      <p className="num-stat text-white">{value}</p>
    </div>
  );
}
