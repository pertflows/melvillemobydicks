'use client';

import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useState, useTransition } from 'react';
import { ClipboardList, Play, Undo2 } from 'lucide-react';
import { reopenGame } from '@/lib/actions/scoring';
import type { SeriesGame } from '@/lib/queries/scoring';

/**
 * What a finished game offers.
 *
 * Two ways to correct it, because they answer different questions. The stat
 * sheet is for reconciling against the paper book - quick, per player, and it
 * does not pretend to know how a run scored. Reopening the scorebook is for
 * when a particular play was wrong and you want the record itself to be right.
 *
 * And, first, the next game: they play two every night, so finishing one is
 * usually the middle of the evening rather than the end of it. Walking back out
 * to a list to find the nightcap is the wrong ending for a phone at a field.
 */
export function FinalGame({
  gameId,
  siblings,
}: {
  gameId: string;
  siblings: SeriesGame[];
}) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // The nightcap, if there is one still to play.
  const nextUp = siblings.find((g) => g.status !== 'final' && g.status !== 'cancelled') ?? null;

  const reopen = () =>
    startTransition(async () => {
      const result = await reopenGame(gameId);
      if (result.error) {
        setMessage(result.error);
        return;
      }
      router.push(`/admin/live/${gameId}?correct=1`);
    });

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <p className="type-eyebrow text-steel-500">Final</p>
      <h1 className="type-section mt-1 text-xl text-white">This game is finished</h1>
      <p className="mt-2 max-w-prose text-sm text-steel-400">
        It still can be corrected. Nothing here changes the game&rsquo;s status, so the
        public site goes on showing it as final while you work.
      </p>

      {nextUp && (
        <Link
          href={`/admin/live/${nextUp.id}`}
          className="mt-7 flex items-center gap-4 bg-gold-400 px-5 py-5 text-navy-950 transition-colors hover:bg-gold-300"
        >
          <Play size={20} className="shrink-0" aria-hidden />
          <span>
            <span className="type-section block text-sm">
              Score game {nextUp.gameNumber}
              {nextUp.opponentName ? ` vs ${nextUp.opponentName}` : ''}
            </span>
            <span className="mt-0.5 block text-xs opacity-80">
              {nextUp.hasLineup
                ? 'Lineup already set — pick up where you left off.'
                : 'You can copy tonight\u2019s batting order straight across.'}
            </span>
          </span>
        </Link>
      )}

      <div className="mt-7 flex flex-col gap-px bg-white/5">
        <Link
          href={`/admin/games/${gameId}/stats`}
          className="flex items-start gap-4 bg-ink-900 px-5 py-5 transition-colors hover:bg-ink-800"
        >
          <ClipboardList size={20} className="mt-0.5 shrink-0 text-gold-400" aria-hidden />
          <span>
            <span className="type-section block text-sm text-white">Correct the stats</span>
            <span className="mt-1 block text-xs leading-relaxed text-steel-500">
              One line per player — at-bats, hits, RBI and the rest — typed off the paper
              book. What you type wins; the columns you leave alone keep deriving from the
              plays.
            </span>
          </span>
        </Link>

        <button
          type="button"
          onClick={reopen}
          disabled={pending}
          className="flex w-full items-start gap-4 bg-ink-900 px-5 py-5 text-left transition-colors hover:bg-ink-800 disabled:opacity-60"
        >
          <Undo2 size={20} className="mt-0.5 shrink-0 text-steel-400" aria-hidden />
          <span>
            <span className="type-section block text-sm text-white">
              {pending ? 'Opening…' : 'Reopen the scorebook'}
            </span>
            <span className="mt-1 block text-xs leading-relaxed text-steel-500">
              Add a play that was missed, undo a wrong one, move a runner, fix the
              linescore. Every statistic re-derives from the plays, so nothing is entered
              by hand.
            </span>
          </span>
        </button>
      </div>

      {message && (
        <p role="alert" className="mt-5 border-l-[3px] border-loss bg-loss/10 px-4 py-3 text-sm text-white">
          {message}
        </p>
      )}
    </div>
  );
}
