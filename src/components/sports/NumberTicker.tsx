'use client';

import { useEffect, useRef, useState } from 'react';
import { useInView, useMotionValue, useSpring, useReducedMotion } from 'motion/react';
import { formatRate } from '@/lib/format';
import { cn } from '@/lib/cn';

/**
 * Counts a statistic up when it first scrolls into view.
 *
 * Reinforces that these are computed, live numbers rather than typed-in text.
 * With reduced motion the value renders immediately and no animation state is
 * involved at all - the motion is decoration, the number is the content.
 *
 * `rate` formats without a leading zero (.568), which is what every average on
 * this site needs and no off-the-shelf counter does.
 */
export function NumberTicker({
  value,
  rate = false,
  decimals = 0,
  className,
}: {
  value: number | null;
  rate?: boolean;
  decimals?: number;
  className?: string;
}) {
  const reduceMotion = useReducedMotion();

  if (value === null) {
    return <span className={cn('tabular-nums', className)}>—</span>;
  }

  // Static render: no observers, no springs, no animation state.
  if (reduceMotion) {
    return (
      <span className={cn('tabular-nums', className)}>
        {rate ? formatRate(value) : value.toFixed(decimals)}
      </span>
    );
  }

  return <AnimatedTicker value={value} rate={rate} decimals={decimals} className={className} />;
}

function AnimatedTicker({
  value,
  rate,
  decimals,
  className,
}: {
  value: number;
  rate: boolean;
  decimals: number;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: '-12% 0px' });

  const motionValue = useMotionValue(0);
  const spring = useSpring(motionValue, { damping: 26, stiffness: 90, mass: 0.7 });
  const [display, setDisplay] = useState(0);

  // Only drives the motion value; React state is updated from the spring
  // subscription below rather than synchronously during the effect.
  useEffect(() => {
    if (inView) motionValue.set(value);
  }, [inView, value, motionValue]);

  useEffect(() => spring.on('change', setDisplay), [spring]);

  return (
    <span ref={ref} className={cn('tabular-nums', className)}>
      {/* The accessible value is always the real one, never a mid-animation frame. */}
      <span aria-hidden>{rate ? formatRate(display) : display.toFixed(decimals)}</span>
      <span className="sr-only">{rate ? formatRate(value) : value.toFixed(decimals)}</span>
    </span>
  );
}
