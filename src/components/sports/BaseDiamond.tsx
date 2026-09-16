import { cn } from '@/lib/cn';
import { describeBases } from '@/lib/format';

/**
 * Base state as an actual rotated diamond, with square bases rather than dots.
 *
 * Always paired with a text equivalent, so the state is available to screen
 * readers and survives greyscale. See DESIGN-SYSTEM 4.7.
 */
export function BaseDiamond({
  first,
  second,
  third,
  size = 'md',
  className,
}: {
  first: boolean;
  second: boolean;
  third: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}) {
  const box = { sm: 'h-12 w-12', md: 'h-20 w-20', lg: 'h-28 w-28' }[size];
  const base = { sm: 'h-3.5 w-3.5', md: 'h-5 w-5', lg: 'h-7 w-7' }[size];

  const cell = (occupied: boolean) =>
    cn(
      base,
      'absolute transition-colors duration-150',
      occupied ? 'bg-gold-400' : 'bg-transparent ring-1 ring-inset ring-white/25',
    );

  return (
    <div className={cn('relative', box, className)} role="img" aria-label={describeBases([first, second, third])}>
      <div className="absolute inset-0 rotate-45">
        {/* second base: top of the diamond */}
        <span className={cn(cell(second), 'left-0 top-0')} />
        {/* third base: left */}
        <span className={cn(cell(third), 'bottom-0 left-0')} />
        {/* first base: right */}
        <span className={cn(cell(first), 'right-0 top-0')} />
        {/* home plate */}
        <span className={cn(base, 'absolute bottom-0 right-0 bg-white/15')} />
      </div>
    </div>
  );
}
