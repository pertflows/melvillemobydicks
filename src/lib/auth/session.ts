import { cache } from 'react';
import { redirect } from 'next/navigation';
import { createClient } from '../supabase/server';

export type AppRole = 'admin' | 'scorekeeper' | 'viewer';

export interface SessionUser {
  id: string;
  email: string | null;
  fullName: string | null;
  role: AppRole;
}

/**
 * The signed-in user plus their role, deduped per request.
 *
 * Reads the role from `profiles` rather than trusting anything in the token,
 * so promoting or demoting somebody takes effect on their next request.
 */
export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  const db = await createClient();

  const {
    data: { user },
  } = await db.auth.getUser();

  if (!user) return null;

  const { data: profile } = await db
    .from('profiles')
    .select('role, full_name, email')
    .eq('id', user.id)
    .maybeSingle();

  return {
    id: user.id,
    email: profile?.email ?? user.email ?? null,
    fullName: profile?.full_name ?? null,
    role: (profile?.role as AppRole) ?? 'viewer',
  };
});

/** Guard for admin pages. Redirects rather than rendering an empty shell. */
export async function requireAdmin(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect('/login?next=/admin');
  if (user.role !== 'admin') redirect('/admin/no-access');
  return user;
}

/** Guard for scorekeeping. Admins are implicitly scorekeepers. */
export async function requireScorekeeper(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect('/login?next=/admin');
  if (user.role !== 'admin' && user.role !== 'scorekeeper') redirect('/admin/no-access');
  return user;
}
