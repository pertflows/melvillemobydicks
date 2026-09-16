import Link from 'next/link';
import { getSessionUser } from '@/lib/auth/session';

export default async function NoAccessPage() {
  const user = await getSessionUser();

  return (
    <div className="mx-auto max-w-lg px-6 py-20">
      <div className="mb-4 h-[3px] w-10 bg-gold-400" aria-hidden />
      <h1 className="type-display text-[2rem] text-white">No access</h1>
      <p className="mt-4 text-steel-400">
        You are signed in as {user?.email ?? 'an unknown user'} with the{' '}
        <strong className="text-steel-200">{user?.role ?? 'viewer'}</strong> role. Managing
        the team requires the admin role.
      </p>
      <p className="mt-3 text-sm text-steel-500">
        An existing admin can change your role from the team admin area.
      </p>
      <Link href="/" className="type-eyebrow mt-8 inline-block bg-white/10 px-5 py-3 text-white ring-1 ring-inset ring-white/20 hover:bg-white/15">
        Back to the site
      </Link>
    </div>
  );
}
