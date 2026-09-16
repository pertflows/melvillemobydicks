import type { Metadata } from 'next';
import Link from 'next/link';
import { PageHeader } from '@/components/site/PageHeader';
import { Reveal } from '@/components/sports/Reveal';
import { getPosts } from '@/lib/queries/content';
import { formatGameDateLong } from '@/lib/time';

export const revalidate = 60;

export const metadata: Metadata = {
  title: "Captain's Log",
  description: 'Game reports and dispatches from the Melville Moby Dicks.',
};

export default async function CaptainsLogPage() {
  const posts = await getPosts();
  const [lead, ...rest] = posts;

  return (
    <>
      <PageHeader
        eyebrow="Dispatch"
        title="Captain's Log"
        lede="Reports from the diamond, written after the final out."
        stat={{ label: 'Entries', value: posts.length }}
      />

      <div className="mx-auto max-w-5xl px-gutter py-section">
        {lead && (
          <Reveal>
            <Link href={`/captains-log/${lead.slug}`} className="group mb-block block bg-navy-900 p-6 transition-colors hover:bg-navy-800 sm:p-10">
              <p className="type-eyebrow mb-4 text-gold-400">
                Latest
                {lead.publishedAt && <> · {formatGameDateLong(lead.publishedAt)}</>}
              </p>
              <h2 className="type-display text-[clamp(1.5rem,4vw,2.5rem)] text-white">
                {lead.title}
              </h2>
              <p className="type-editorial mt-5 max-w-[68ch] text-steel-300 line-clamp-3">
                {lead.paragraphs[0]}
              </p>
              <p className="type-eyebrow mt-6 text-steel-400 group-hover:text-white">Read entry →</p>
            </Link>
          </Reveal>
        )}

        <ol className="flex flex-col gap-px bg-white/5">
          {rest.map((post, i) => (
            <li key={post.id}>
              <Reveal delay={Math.min(i, 6) * 0.04}>
                <Link href={`/captains-log/${post.slug}`} className="group block bg-ink-900 px-5 py-6 transition-colors hover:bg-ink-800 sm:px-7">
                  <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                    <time className="type-eyebrow text-steel-500" dateTime={post.publishedAt ?? undefined}>
                      {post.publishedAt && formatGameDateLong(post.publishedAt)}
                    </time>
                    {post.gameLabel && (
                      <span className="type-eyebrow text-navy-300">{post.gameLabel}</span>
                    )}
                  </div>

                  <h3 className="type-section mt-2.5 text-white group-hover:text-gold-200">
                    {post.title}
                  </h3>

                  <p className="mt-3 max-w-[68ch] text-sm leading-relaxed text-steel-400 line-clamp-2">
                    {post.paragraphs[0]}
                  </p>

                  {post.authorName && (
                    <p className="type-eyebrow mt-4 text-[10px] text-steel-600">
                      {post.authorName}
                    </p>
                  )}
                </Link>
              </Reveal>
            </li>
          ))}
        </ol>
      </div>
    </>
  );
}
