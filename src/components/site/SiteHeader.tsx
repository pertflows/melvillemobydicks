'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Menu, X } from 'lucide-react';
import { cn } from '@/lib/cn';

const NAV = [
  { href: '/', label: 'Home' },
  { href: '/roster', label: 'Roster' },
  { href: '/schedule', label: 'Schedule' },
  { href: '/stats', label: 'Stats' },
  { href: '/captains-log', label: "Captain's Log" },
  { href: '/media', label: 'Media' },
  { href: '/sponsors', label: 'Sponsors' },
];

export function SiteHeader({ logoUrl }: { logoUrl: string | null }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    // Read the initial position on the next frame rather than synchronously
    // during the effect, which would cascade a second render on mount.
    const raf = requestAnimationFrame(onScroll);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('scroll', onScroll);
    };
  }, []);

  const isActive = (href: string) =>
    href === '/' ? pathname === '/' : pathname.startsWith(href);

  return (
    <header
      className={cn(
        'sticky top-0 z-50 transition-colors duration-200',
        scrolled || open
          ? 'bg-ink-950/95 backdrop-blur-sm hairline-b'
          : 'bg-transparent border-b border-transparent',
      )}
    >
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-gutter">
        <Link href="/" className="flex items-center gap-3" aria-label="Melville Moby Dicks home">
          {logoUrl ? (
            <Image src={logoUrl} alt="" width={36} height={36} className="h-9 w-9 object-contain" priority />
          ) : (
            <span className="h-9 w-9 bg-gold-400" aria-hidden />
          )}
          <span className="type-section hidden text-base text-white sm:block">
            Melville Moby Dicks
          </span>
        </Link>

        <nav className="hidden items-center gap-1 lg:flex" aria-label="Primary">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              aria-current={isActive(item.href) ? 'page' : undefined}
              className={cn(
                'type-eyebrow relative px-3 py-2 transition-colors',
                isActive(item.href) ? 'text-white' : 'text-steel-400 hover:text-white',
              )}
            >
              {item.label}
              {isActive(item.href) && (
                <span className="absolute inset-x-3 -bottom-px h-[2px] bg-gold-400" aria-hidden />
              )}
            </Link>
          ))}
        </nav>

        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="-mr-2 inline-flex h-11 w-11 items-center justify-center text-steel-300 lg:hidden"
          aria-expanded={open}
          aria-controls="mobile-nav"
          aria-label={open ? 'Close menu' : 'Open menu'}
        >
          {open ? <X size={22} /> : <Menu size={22} />}
        </button>
      </div>

      {open && (
        <nav
          id="mobile-nav"
          className="hairline-t bg-ink-950 lg:hidden"
          aria-label="Primary (mobile)"
        >
          <ul className="mx-auto max-w-7xl px-gutter py-2">
            {NAV.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  onClick={() => setOpen(false)}
                  aria-current={isActive(item.href) ? 'page' : undefined}
                  className={cn(
                    'type-section flex items-center gap-3 border-l-[3px] py-3.5 pl-4 text-base transition-colors',
                    isActive(item.href)
                      ? 'border-gold-400 text-white'
                      : 'border-transparent text-steel-400 hover:text-white',
                  )}
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      )}
    </header>
  );
}
