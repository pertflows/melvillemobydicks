import { cn } from '@/lib/cn';

/**
 * A jersey number is never inline text - it is a block.
 *
 * Zero radius, condensed heavy numerals, and bottom-heavy padding because
 * digits sit optically high inside their own box. See DESIGN-SYSTEM 4.1.
 */

const SIZES = {
  sm: 'min-w-8 h-8 text-lg px-1.5',
  md: 'min-w-11 h-11 text-2xl px-2',
  lg: 'min-w-16 h-16 text-4xl px-2.5',
  xl: 'min-w-24 h-24 text-6xl px-3',
} as const;

const TONES = {
  gold: 'bg-gold-400 text-navy-950',
  navy: 'bg-navy-700 text-white',
  outline: 'bg-transparent text-steel-200 ring-1 ring-inset ring-white/15',
  ghost: 'bg-white/5 text-steel-300',
} as const;

export function JerseyNumber({
  value,
  size = 'md',
  tone = 'navy',
  className,
}: {
  value: number | null | undefined;
  size?: keyof typeof SIZES;
  tone?: keyof typeof TONES;
  className?: string;
}) {
  if (value === null || value === undefined) return null;

  return (
    <span
      className={cn(
        'num-base inline-flex items-center justify-center font-extrabold leading-none',
        'pt-0.5 pb-1 tabular-nums select-none',
        SIZES[size],
        TONES[tone],
        className,
      )}
      style={{ fontStretch: '70%' }}
      aria-label={`Number ${value}`}
    >
      {value}
    </span>
  );
}

/**
 * Oversized number used as a watermark behind player imagery. Decorative only.
 */
export function JerseyWatermark({
  value,
  className,
}: {
  value: number | null | undefined;
  className?: string;
}) {
  if (value === null || value === undefined) return null;

  return (
    <span
      aria-hidden
      className={cn(
        'num-base pointer-events-none absolute select-none font-extrabold leading-none',
        'text-[clamp(10rem,32vw,26rem)] text-white/[0.06]',
        className,
      )}
      style={{ fontStretch: '65%' }}
    >
      {value}
    </span>
  );
}
