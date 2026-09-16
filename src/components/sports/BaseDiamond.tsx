import { cn } from '@/lib/cn';
import { describeBases } from '@/lib/format';

/**
 * Base state drawn as an actual diamond.
 *
 * SVG rather than rotated divs so the geometry is exact at any size: bases are
 * squares standing on a corner, laid out around home plate the way a scorebook
 * draws them. Occupied bases fill gold; empty ones are hairline outlines.
 *
 * Always paired with a text equivalent - the shape alone is not accessible, and
 * colour alone is not a signal. See DESIGN-SYSTEM 4.7.
 */

const SIZES = { sm: 44, md: 76, lg: 108 } as const;

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
  size?: keyof typeof SIZES;
  className?: string;
}) {
  const px = SIZES[size];

  // Viewbox is 100x100. Home sits at the bottom, second at the top.
  const half = size === 'sm' ? 9 : 11;
  const bases = [
    { x: 78, y: 50, occupied: first, label: 'first' },
    { x: 50, y: 22, occupied: second, label: 'second' },
    { x: 22, y: 50, occupied: third, label: 'third' },
  ];

  const square = (cx: number, cy: number, r: number) =>
    `${cx},${cy - r} ${cx + r},${cy} ${cx},${cy + r} ${cx - r},${cy}`;

  return (
    <svg
      width={px}
      height={px}
      viewBox="0 0 100 100"
      className={cn('shrink-0', className)}
      role="img"
      aria-label={describeBases([first, second, third])}
    >
      {/* base paths */}
      <polygon
        points={square(50, 50, 30)}
        fill="none"
        stroke="currentColor"
        strokeWidth={1}
        className="text-white/10"
      />

      {bases.map((b) => (
        <polygon
          key={b.label}
          points={square(b.x, b.y, half)}
          className={b.occupied ? 'fill-gold-400' : 'fill-transparent'}
          stroke="currentColor"
          strokeWidth={b.occupied ? 0 : 1.5}
          strokeLinejoin="round"
          style={{ color: 'rgba(255,255,255,0.28)' }}
        />
      ))}

      {/* home plate */}
      <polygon
        points={`${50 - half * 0.8},${78 - half * 0.5} ${50 + half * 0.8},${78 - half * 0.5} ${50 + half * 0.8},${78 + half * 0.3} 50,${78 + half} ${50 - half * 0.8},${78 + half * 0.3}`}
        className="fill-white/20"
      />
    </svg>
  );
}
