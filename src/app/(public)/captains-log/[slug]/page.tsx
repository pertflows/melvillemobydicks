import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getPostBySlug } from '@/lib/queries/content';
import { formatGameDateLong } from '@/lib/time';

export const revalidate = 60;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const post = await getPostBySlug(slug);
  if (!post) return {};

  return {
    title: post.title,
    description: post.excerpt ?? post.paragraphs[0]?.slice(0, 160),
    openGraph: { type: 'article', publishedTime: post.publishedAt ?? undefined },
  };
}

export default async function PostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = await getPostBySlug(slug);
  if (!post) notFound();

  return (
    <article className="mx-auto max-w-3xl px-gutter py-section">
      <Link href="/captains-log" className="type-eyebrow mb-10 inline-block whitespace-nowrap text-steel-500 hover:text-white">
        ← Captain&rsquo;s Log
      </Link>

      <header className="mb-block">
        <div className="mb-5 h-[3px] w-10 bg-gold-400" aria-hidden />

        <div className="type-eyebrow mb-4 flex flex-wrap items-center gap-x-3 gap-y-1 text-steel-500">
          {post.publishedAt && (
            <time dateTime={post.publishedAt}>{formatGameDateLong(post.publishedAt)}</time>
          )}
          {post.authorName && <span className="text-steel-400">{post.authorName}</span>}
          {post.gameId && post.gameLabel && (
            <Link href={`/schedule/${post.gameId}`} className="text-navy-300 hover:text-white">
              {post.gameLabel} →
            </Link>
          )}
        </div>

        <h1 className="type-display text-white">{post.title}</h1>
      </header>

      {/* Body carried over from the original site, paragraph for paragraph. */}
      <div className="space-y-6">
        {post.paragraphs.map((p, i) => (
          <p key={i} className="type-editorial text-steel-300">
            {p}
          </p>
        ))}
      </div>

      {post.gameId && (
        <footer className="mt-section hairline-t pt-8">
          <Link
            href={`/schedule/${post.gameId}`}
            className="type-eyebrow inline-block bg-white/10 px-5 py-3 text-white ring-1 ring-inset ring-white/20 transition-colors hover:bg-white/15"
          >
            View the box score →
          </Link>
        </footer>
      )}
    </article>
  );
}
