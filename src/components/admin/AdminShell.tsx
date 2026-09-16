'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import {
  CalendarDays, ClipboardList, Home, Menu, NotebookPen, Radio, Users, X,
} from 'lucide-react';
import { cn } from '@/lib/cn';
import { signOut } from '@/lib/actions/auth';

const NAV = [
  { href: '/admin', label: 'Dashboard', icon: Home, exact: true },
  { href: '/admin/live', label: 'Live Scorebook', icon: Radio },
  { href: '/admin/games', label: 'Games', icon: CalendarDays },
  { href: '/admin/roster', label: 'Roster', icon: Users },
  { href: '/admin/posts', label: "Captain's Log", icon: NotebookPen },
  { href: '/admin/activity', label: 'Activity', icon: ClipboardList },
];

/**
 * Admin chrome. Deliberately quieter than the public site - this is a tool, so
 * legibility and reach beat spectacle.
 */
export function AdminShell({
  children,
  userName,
  role,
}: {
  children: React.ReactNode;
  userName: string | null;
  role: string;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const isActive = (href: string, exact?: boolean) =>
    exact ? pathname === href : pathname.startsWith(href);

  return (
    <div className="min-h-screen bg-ink-950 lg:grid lg:grid-cols-[15rem_1fr]">
      {/* -- sidebar (desktop) ------------------------------------------- */}
      <aside className="hidden border-r border-white/10 bg-ink-900 lg:block">
        <div className="sticky top-0 flex h-screen flex-col">
          <Link href="/admin" className="flex items-center gap-2.5 px-5 py-5">
            <span className="h-7 w-[3px] bg-gold-400" aria-hidden />
            <span className="type-section text-sm text-white">Moby Dicks Admin</span>
          </Link>

          <nav className="flex-1 px-2" aria-label="Admin">
            {NAV.map((item) => (
              <NavLink key={item.href} {...item} active={isActive(item.href, item.exact)} />
            ))}
          </nav>

          <div className="border-t border-white/10 p-4">
            <p className="truncate text-sm text-steel-300">{userName ?? 'Signed in'}</p>
            <p className="type-eyebrow mt-1 text-[10px] text-steel-600">{role}</p>
            <div className="mt-3 flex flex-col gap-2">
              <Link href="/" className="type-eyebrow text-steel-500 hover:text-white">
                View site →
              </Link>
              <form action={signOut}>
                <button type="submit" className="type-eyebrow text-steel-500 hover:text-white">
                  Sign out
                </button>
              </form>
            </div>
          </div>
        </div>
      </aside>

      {/* -- top bar (mobile) --------------------------------------------- */}
      <div className="flex min-w-0 flex-col">
        <header className="sticky top-0 z-40 flex h-14 items-center justify-between border-b border-white/10 bg-ink-900 px-4 lg:hidden">
          <Link href="/admin" className="type-section text-sm text-white">
            Moby Dicks Admin
          </Link>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="-mr-2 inline-flex h-11 w-11 items-center justify-center text-steel-300"
            aria-expanded={open}
            aria-label={open ? 'Close menu' : 'Open menu'}
          >
            {open ? <X size={20} /> : <Menu size={20} />}
          </button>
        </header>

        {open && (
          <nav className="border-b border-white/10 bg-ink-900 p-2 lg:hidden" aria-label="Admin (mobile)">
            {NAV.map((item) => (
              <NavLink
                key={item.href}
                {...item}
                active={isActive(item.href, item.exact)}
                onClick={() => setOpen(false)}
              />
            ))}
            <form action={signOut} className="px-3 py-3">
              <button type="submit" className="type-eyebrow text-steel-500">
                Sign out
              </button>
            </form>
          </nav>
        )}

        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  );
}

function NavLink({
  href,
  label,
  icon: Icon,
  active,
  onClick,
}: {
  href: string;
  label: string;
  icon: React.ComponentType<{ size?: number }>;
  active: boolean;
  onClick?: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'flex items-center gap-3 border-l-[3px] px-3 py-3 text-sm transition-colors',
        active
          ? 'border-gold-400 bg-white/5 text-white'
          : 'border-transparent text-steel-400 hover:bg-white/5 hover:text-white',
      )}
    >
      <Icon size={17} />
      {label}
    </Link>
  );
}
