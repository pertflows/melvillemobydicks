import Image from 'next/image';
import { cn } from '@/lib/cn';
import { JerseyNumber } from './JerseyNumber';

/**
 * Player imagery with a graceful fallback.
 *
 * Four players have no photo on record. Rather than an emoji placeholder (what
 * the old site did), the fallback is a navy field carrying the player's number
 * as a watermark - it still reads as part of the system.
 */
export function PlayerPortrait({
  src,
  alt,
  jerseyNumber,
  placeholder,
  sizes,
  priority,
  className,
}: {
  src: string | null;
  alt: string;
  jerseyNumber?: number | null;
  placeholder?: string | null;
  sizes?: string;
  priority?: boolean;
  className?: string;
}) {
  if (!src) {
    return (
      <div
        className={cn(
          'relative flex items-center justify-center overflow-hidden bg-navy-900',
          className,
        )}
      >
        <div
          aria-hidden
          className="absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage:
              'repeating-linear-gradient(135deg, white 0 1px, transparent 1px 14px)',
          }}
        />
        {jerseyNumber !== null && jerseyNumber !== undefined ? (
          <span
            aria-hidden
            className="num-base select-none text-[5rem] font-extrabold leading-none text-white/15"
            style={{ fontStretch: '65%' }}
          >
            {jerseyNumber}
          </span>
        ) : (
          <JerseyNumber value={null} />
        )}
        <span className="sr-only">{alt} — no photo on record</span>
      </div>
    );
  }

  return (
    <div className={cn('relative overflow-hidden bg-navy-900', className)}>
      <Image
        src={src}
        alt={alt}
        fill
        sizes={sizes ?? '(max-width: 640px) 50vw, 320px'}
        priority={priority}
        className="object-cover object-top"
        {...(placeholder ? { placeholder: 'blur' as const, blurDataURL: placeholder } : {})}
      />
    </div>
  );
}
