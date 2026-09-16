import Link from 'next/link';

export function SiteFooter({ seasonName }: { seasonName?: string }) {
  return (
    <footer className="hairline-t mt-section bg-ink-950">
      <div className="mx-auto max-w-7xl px-gutter py-12">
        <div className="flex flex-col gap-8 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="mb-3 h-[3px] w-10 bg-gold-400" aria-hidden />
            <p className="type-section text-white">The Melville Moby Dicks</p>
            <p className="mt-2 max-w-sm text-sm text-steel-500">
              Softball in Melville, New York{seasonName ? ` · ${seasonName} season` : ''}.
            </p>
          </div>

          <nav aria-label="Footer" className="flex flex-wrap gap-x-6 gap-y-3">
            {[
              ['/roster', 'Roster'],
              ['/schedule', 'Schedule'],
              ['/stats', 'Stats'],
              ['/captains-log', "Captain's Log"],
              ['/sponsors', 'Sponsors'],
              ['/admin', 'Admin'],
            ].map(([href, label]) => (
              <Link
                key={href}
                href={href}
                className="type-eyebrow text-steel-500 transition-colors hover:text-white"
              >
                {label}
              </Link>
            ))}
          </nav>
        </div>

        <p className="mt-10 text-xs text-steel-600">
          © {new Date().getFullYear()} The Melville Moby Dicks.
        </p>
      </div>
    </footer>
  );
}
