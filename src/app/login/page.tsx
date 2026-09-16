import type { Metadata } from 'next';
import Link from 'next/link';
import { LoginForm } from './LoginForm';

export const metadata: Metadata = {
  title: 'Sign in',
  robots: { index: false, follow: false },
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-gutter py-12">
      <div className="w-full max-w-sm">
        <Link href="/" className="type-eyebrow mb-10 inline-block whitespace-nowrap text-steel-500 hover:text-white">
          ← Moby Dicks
        </Link>

        <div className="mb-8">
          <div className="mb-4 h-[3px] w-10 bg-gold-400" aria-hidden />
          <h1 className="type-display text-[2rem] text-white">Team Admin</h1>
          <p className="mt-3 text-sm text-steel-400">
            Sign in to manage the roster, schedule and scorebook.
          </p>
        </div>

        <LoginForm next={next} />
      </div>
    </div>
  );
}
