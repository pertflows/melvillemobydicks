import Link from 'next/link';
import { cn } from '@/lib/cn';

/**
 * Section header with a gold rule above it - the recurring editorial device
 * that separates major blocks without resorting to card borders.
 */
export function SectionHeading({
  eyebrow,
  title,
  href,
  linkLabel = 'View all',
  className,
}: {
  eyebrow?: string;
  title: string;
  href?: string;
  linkLabel?: string;
  className?: string;
}) {
  return (
    <div className={cn('mb-6 flex items-end justify-between gap-6', className)}>
      <div>
        <div className="mb-3 h-[3px] w-10 bg-gold-400" aria-hidden />
        {eyebrow && <p className="type-eyebrow mb-1.5 text-gold-400">{eyebrow}</p>}
        <h2 className="type-section text-white">{title}</h2>
      </div>

      {href && (
        <Link
          href={href}
          className="type-eyebrow shrink-0 pb-1 text-steel-400 transition-colors hover:text-white"
        >
          {linkLabel} →
        </Link>
      )}
    </div>
  );
}
