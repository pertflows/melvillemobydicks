import type { Metadata } from 'next';
import { AdminShell } from '@/components/admin/AdminShell';
import { getSessionUser } from '@/lib/auth/session';
import { redirect } from 'next/navigation';

export const metadata: Metadata = {
  title: { default: 'Admin', template: '%s — Moby Dicks Admin' },
  robots: { index: false, follow: false },
};

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser();
  if (!user) redirect('/login?next=/admin');

  return (
    <AdminShell userName={user.fullName ?? user.email} role={user.role}>
      {children}
    </AdminShell>
  );
}
