import { cn } from '@/lib/cn';

/**
 * Standard interior page masthead: gold rule, eyebrow, display title, and an
 * optional headline number on the right. Keeps every section page on the same
 * rhythm without repeating markup.
 */
export function PageHeader({
  eyebrow,
  title,
  lede,
  stat,
  className,
  children,
}: {
  eyebrow?: string;
  title: string;
  lede?: string;
  stat?: { label: string; value: string | number };
  className?: string;
  children?: React.ReactNode;
}) {
  return (
    <header className={cn('hairline-b bg-navy-950/40', className)}>
      <div className="mx-auto max-w-7xl px-gutter pb-block pt-12 sm:pt-16">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div className="min-w-0">
            <div className="mb-4 h-[3px] w-10 bg-gold-400" aria-hidden />
            {eyebrow && <p className="type-eyebrow mb-2 text-gold-400">{eyebrow}</p>}
            <h1 className="type-display text-white">{title}</h1>
            {lede && <p className="mt-4 max-w-xl text-steel-400">{lede}</p>}
          </div>

          {stat && (
            <div className="shrink-0 text-right">
              <p className="type-eyebrow mb-2 text-steel-500">{stat.label}</p>
              <p className="num-stat-xl text-white">{stat.value}</p>
            </div>
          )}
        </div>

        {children}
      </div>
    </header>
  );
}
