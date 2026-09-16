import Link from 'next/link';
import { cn } from '@/lib/cn';

/** Consistent admin page header with optional actions. */
export function AdminPage({
  title,
  description,
  actions,
  children,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
      <header className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="type-section text-2xl text-white">{title}</h1>
          {description && <p className="mt-2 max-w-2xl text-sm text-steel-400">{description}</p>}
        </div>
        {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
      </header>
      {children}
    </div>
  );
}

export function AdminButton({
  href,
  children,
  variant = 'secondary',
  type,
  disabled,
  onClick,
  className,
}: {
  href?: string;
  children: React.ReactNode;
  variant?: 'primary' | 'secondary' | 'danger';
  type?: 'button' | 'submit';
  disabled?: boolean;
  onClick?: () => void;
  className?: string;
}) {
  const styles = cn(
    'type-eyebrow inline-flex items-center justify-center px-4 py-2.5 transition-colors disabled:opacity-50',
    variant === 'primary' && 'bg-gold-400 text-navy-950 hover:bg-gold-300',
    variant === 'secondary' &&
      'bg-white/10 text-white ring-1 ring-inset ring-white/15 hover:bg-white/15',
    variant === 'danger' && 'bg-loss/15 text-loss ring-1 ring-inset ring-loss/30 hover:bg-loss/25',
    className,
  );

  if (href) {
    return (
      <Link href={href} className={styles}>
        {children}
      </Link>
    );
  }

  return (
    <button type={type ?? 'button'} disabled={disabled} onClick={onClick} className={styles}>
      {children}
    </button>
  );
}

export function Panel({
  title,
  children,
  className,
}: {
  title?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn('bg-ink-900 ring-1 ring-inset ring-white/10', className)}>
      {title && (
        <h2 className="type-eyebrow border-b border-white/10 px-5 py-3.5 text-steel-400">
          {title}
        </h2>
      )}
      {children}
    </section>
  );
}
