import type { Metadata } from 'next';
import Image from 'next/image';
import { PageHeader } from '@/components/site/PageHeader';
import { getSponsors } from '@/lib/queries/content';

export const revalidate = 300;

export const metadata: Metadata = {
  title: 'Sponsors',
  description: 'The businesses that keep the Melville Moby Dicks on the diamond.',
};

export default async function SponsorsPage() {
  const sponsors = await getSponsors();

  return (
    <>
      <PageHeader
        eyebrow="Support"
        title="Sponsors"
        lede="Proud supporters who keep us on the diamond."
        stat={{ label: 'Partners', value: sponsors.length }}
      />

      <div className="mx-auto max-w-7xl px-gutter py-section">
        <ul className="grid gap-px bg-white/5 sm:grid-cols-2 lg:grid-cols-3">
          {sponsors.map((s) => {
            const Card = (
              <>
                <div className="relative mb-6 flex h-24 items-center justify-center">
                  {s.logoUrl ? (
                    <Image
                      src={s.logoUrl}
                      alt={s.name}
                      width={220}
                      height={96}
                      className="max-h-24 w-auto object-contain"
                    />
                  ) : (
                    <span className="type-section text-steel-600">{s.name}</span>
                  )}
                </div>
                <h2 className="type-section text-center text-sm text-white">{s.name}</h2>
                {s.blurb && (
                  <p className="mt-2 text-center text-sm text-steel-500">{s.blurb}</p>
                )}
                {s.websiteUrl && (
                  <p className="type-eyebrow mt-4 text-center text-steel-500 group-hover:text-gold-400">
                    Visit site →
                  </p>
                )}
              </>
            );

            return (
              <li key={s.id}>
                {s.websiteUrl ? (
                  <a
                    href={s.websiteUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group flex h-full flex-col bg-ink-900 p-6 transition-colors hover:bg-ink-800"
                  >
                    {Card}
                  </a>
                ) : (
                  <div className="flex h-full flex-col bg-ink-900 p-6">{Card}</div>
                )}
              </li>
            );
          })}
        </ul>
      </div>
    </>
  );
}
