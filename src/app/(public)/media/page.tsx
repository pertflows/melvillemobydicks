import type { Metadata } from 'next';
import { PageHeader } from '@/components/site/PageHeader';
import { getGallery } from '@/lib/queries/content';
import { Gallery } from './Gallery';

export const revalidate = 60;

export const metadata: Metadata = {
  title: 'Media',
  description: 'Photos from the diamond.',
};

export default async function MediaPage() {
  const items = await getGallery();

  return (
    <>
      <PageHeader
        eyebrow="Gallery"
        title="Media"
        lede="Photos from the diamond."
        stat={{ label: 'Photos', value: items.length }}
      />

      <div className="mx-auto max-w-7xl px-gutter py-section">
        {items.length > 0 ? (
          <Gallery items={items} />
        ) : (
          <p className="bg-ink-900 px-6 py-10 text-center text-sm text-steel-400">
            No photos yet.
          </p>
        )}
      </div>
    </>
  );
}
