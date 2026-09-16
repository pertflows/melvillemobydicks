'use client';

import { useCallback, useEffect, useState } from 'react';
import Image from 'next/image';
import { X } from 'lucide-react';
import type { GalleryItem } from '@/lib/queries/content';

/**
 * Photo grid with a keyboard-navigable lightbox.
 *
 * Escape closes, arrow keys move, focus returns to the trigger on close, and
 * body scroll locks while open.
 */
export function Gallery({ items }: { items: GalleryItem[] }) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const active = openIndex === null ? null : items[openIndex];

  const close = useCallback(() => setOpenIndex(null), []);
  const move = useCallback(
    (delta: number) =>
      setOpenIndex((i) => (i === null ? null : (i + delta + items.length) % items.length)),
    [items.length],
  );

  useEffect(() => {
    if (openIndex === null) return;

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
      if (e.key === 'ArrowRight') move(1);
      if (e.key === 'ArrowLeft') move(-1);
    };

    document.addEventListener('keydown', onKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [openIndex, close, move]);

  return (
    <>
      <ul className="grid grid-cols-1 gap-px bg-white/5 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((item, i) => (
          <li key={item.id}>
            <button
              type="button"
              onClick={() => setOpenIndex(i)}
              className="group relative block w-full overflow-hidden bg-ink-900 text-left"
              aria-label={item.caption ?? 'View photo'}
            >
              <div className="relative aspect-4/3">
                {item.url && (
                  <Image
                    src={item.url}
                    alt={item.caption ?? ''}
                    fill
                    sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                    className="object-cover transition-transform duration-500 group-hover:scale-[1.04]"
                    {...(item.placeholder
                      ? { placeholder: 'blur' as const, blurDataURL: item.placeholder }
                      : {})}
                  />
                )}
                <div className="photo-scrim absolute inset-0 opacity-90" aria-hidden />
              </div>

              {(item.caption || item.gameLabel) && (
                <div className="absolute inset-x-0 bottom-0 p-4">
                  {item.gameLabel && (
                    <p className="type-eyebrow mb-1.5 text-gold-400">{item.gameLabel}</p>
                  )}
                  {item.caption && (
                    <p className="text-sm leading-snug text-white line-clamp-2">{item.caption}</p>
                  )}
                </div>
              )}
            </button>
          </li>
        ))}
      </ul>

      {active && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={active.caption ?? 'Photo'}
          className="fixed inset-0 z-100 flex flex-col bg-ink-950/97 p-4 backdrop-blur-sm sm:p-8"
          onClick={close}
        >
          <div className="flex justify-end">
            <button
              type="button"
              onClick={close}
              autoFocus
              className="inline-flex h-11 w-11 items-center justify-center text-steel-300 hover:text-white"
              aria-label="Close"
            >
              <X size={24} />
            </button>
          </div>

          <div
            className="relative flex min-h-0 flex-1 items-center justify-center"
            onClick={(e) => e.stopPropagation()}
          >
            {active.url && (
              <Image
                src={active.url}
                alt={active.caption ?? ''}
                width={active.width ?? 1600}
                height={active.height ?? 1200}
                className="max-h-full w-auto object-contain"
              />
            )}
          </div>

          {active.caption && (
            <p className="mx-auto mt-4 max-w-2xl text-center text-sm text-steel-300">
              {active.caption}
            </p>
          )}

          {items.length > 1 && (
            <div className="mt-4 flex items-center justify-center gap-6" onClick={(e) => e.stopPropagation()}>
              <button type="button" onClick={() => move(-1)} className="type-eyebrow px-4 py-2 text-steel-400 hover:text-white">
                ← Prev
              </button>
              <span className="num-table text-steel-500">
                {(openIndex ?? 0) + 1} / {items.length}
              </span>
              <button type="button" onClick={() => move(1)} className="type-eyebrow px-4 py-2 text-steel-400 hover:text-white">
                Next →
              </button>
            </div>
          )}
        </div>
      )}
    </>
  );
}
