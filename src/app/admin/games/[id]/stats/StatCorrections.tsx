'use client';

import { useState, useTransition } from 'react';
import { JerseyNumber } from '@/components/sports/JerseyNumber';
import { AdminButton } from '@/components/admin/AdminPage';
import { clearStatCorrections, saveStatCorrection } from '@/lib/actions/statCorrections';
import {
  CORRECTABLE, isCorrected,
  type CorrectableStat, type StatCorrectionRow,
} from '@/lib/stats/corrections';
import { formatRate } from '@/lib/format';
import { cn } from '@/lib/cn';
import { EMPTY_LINE, NOTHING_ENTERED } from '@/lib/stats/corrections';

/**
 * The correction sheet: one row per player, typed straight off the paper book.
 *
 * A cell left alone keeps deriving from the plays. A cell that has been typed
 * into is gold, with the counted number underneath it, so the difference
 * between "this is what we counted" and "this is what the book says" is always
 * on screen rather than something to remember.
 */

const COLUMNS: { stat: CorrectableStat; label: string; title: string }[] = [
  { stat: 'ab', label: 'AB', title: 'At-bats' },
  { stat: 'h', label: 'H', title: 'Hits' },
  { stat: 'doubles', label: '2B', title: 'Doubles' },
  { stat: 'triples', label: '3B', title: 'Triples' },
  { stat: 'hr', label: 'HR', title: 'Home runs' },
  { stat: 'r', label: 'R', title: 'Runs' },
  { stat: 'rbi', label: 'RBI', title: 'Runs batted in' },
  { stat: 'bb', label: 'BB', title: 'Walks' },
  { stat: 'k', label: 'K', title: 'Strikeouts' },
];

export function StatCorrections({
  gameId,
  rows: saved,
  roster,
  editable,
}: {
  gameId: string;
  rows: StatCorrectionRow[];
  /** The season roster, so a batter missing from the sheet can be added to it. */
  roster: { id: string; displayName: string; jerseyNumber: number | null }[];
  editable: boolean;
}) {
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  /**
   * Batters added to the sheet by hand.
   *
   * A game imported from the old site has no lineup and no plays, so nobody
   * appears until somebody is put there. Adding a row writes nothing on its
   * own - the first number typed into it is what creates the correction.
   */
  const [added, setAdded] = useState<StatCorrectionRow[]>([]);
  const rows = [...saved, ...added.filter((a) => !saved.some((r) => r.playerId === a.playerId))];

  const missing = roster.filter((p) => !rows.some((r) => r.playerId === p.id));

  const addBatter = (player: { id: string; displayName: string; jerseyNumber: number | null }) =>
    setAdded((current) => [
      ...current,
      {
        playerId: player.id,
        displayName: player.displayName,
        jerseyNumber: player.jerseyNumber,
        battingOrder: null,
        derived: { ...EMPTY_LINE },
        entered: { ...NOTHING_ENTERED },
        note: null,
      },
    ]);

  const save = (playerId: string, stat: CorrectableStat, value: number | null) =>
    startTransition(async () => {
      const result = await saveStatCorrection(gameId, { playerId, values: { [stat]: value } });
      setMessage(result.error ?? null);
    });

  const revertRow = (playerId: string) =>
    startTransition(async () => {
      const cleared = Object.fromEntries(CORRECTABLE.map((s) => [s, null]));
      const result = await saveStatCorrection(gameId, { playerId, values: cleared });
      setMessage(result.error ?? null);
    });

  const revertAll = () =>
    startTransition(async () => {
      const result = await clearStatCorrections(gameId);
      setMessage(result.error ?? null);
    });

  const correctedCount = rows.filter(isCorrected).length;

  if (rows.length === 0 && missing.length === 0) {
    return (
      <p className="bg-ink-900 px-5 py-8 text-sm text-steel-500">
        There is nobody on the roster for this season yet, so there are no lines to
        correct.
      </p>
    );
  }

  return (
    <div>
      {message && (
        <p role="alert" className="mb-4 border-l-[3px] border-loss bg-loss/10 px-4 py-3 text-sm text-white">
          {message}
        </p>
      )}

      {rows.length === 0 ? (
        <p className="bg-ink-900 px-5 py-8 text-sm text-steel-500">
          Nothing was scored in this game, so there is no line to correct yet. Add the
          batters below and type their lines in from the book.
        </p>
      ) : (
      /* A wide grid on a narrow screen: the name column stays put while the
         numbers scroll, which is the only way nine columns fit a phone. */
      <div className="overflow-x-auto ring-1 ring-inset ring-white/10">
        <table className="w-full border-collapse">
          <caption className="sr-only">
            Batting lines for this game. Gold means entered by hand; the number underneath
            is what the recorded plays add up to.
          </caption>
          <thead>
            <tr className="border-b border-white/10 bg-ink-800">
              <th scope="col" className="type-eyebrow sticky left-0 z-10 bg-ink-800 px-3 py-3 text-left text-steel-500">
                Batter
              </th>
              {COLUMNS.map((c) => (
                <th key={c.stat} scope="col" title={c.title} className="type-eyebrow px-1 py-3 text-center text-steel-500">
                  {c.label}
                </th>
              ))}
              <th scope="col" className="type-eyebrow px-3 py-3 text-right text-steel-500">
                AVG
              </th>
              {editable && (
                <th scope="col" className="px-3 py-3">
                  <span className="sr-only">Revert</span>
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const resolved = (stat: CorrectableStat) => row.entered[stat] ?? row.derived[stat];
              const ab = resolved('ab');
              const h = resolved('h');
              const rowCorrected = isCorrected(row);

              return (
                <tr key={row.playerId} className="border-b border-white/5 bg-ink-900">
                  <th scope="row" className="sticky left-0 z-10 bg-ink-900 px-3 py-2 text-left font-normal">
                    <span className="flex items-center gap-2">
                      <JerseyNumber value={row.jerseyNumber} size="sm" tone="ghost" />
                      <span className="whitespace-nowrap text-sm text-white">{row.displayName}</span>
                    </span>
                  </th>

                  {COLUMNS.map((c) => (
                    <td key={c.stat} className="px-1 py-2 text-center align-top">
                      <StatCell
                        value={row.entered[c.stat]}
                        derived={row.derived[c.stat]}
                        disabled={!editable || pending}
                        label={`${c.title} for ${row.displayName}`}
                        onCommit={(v) => save(row.playerId, c.stat, v)}
                      />
                    </td>
                  ))}

                  <td className="num-table whitespace-nowrap px-3 py-2 text-right text-steel-300">
                    {ab > 0 ? formatRate(h / ab) : '—'}
                  </td>

                  {editable && (
                    <td className="px-3 py-2 text-right">
                      {rowCorrected && (
                        <button
                          type="button"
                          onClick={() => revertRow(row.playerId)}
                          disabled={pending}
                          className="type-eyebrow whitespace-nowrap text-[9px] text-steel-500 underline underline-offset-2 hover:text-white"
                        >
                          Use plays
                        </button>
                      )}
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      )}

      {editable && missing.length > 0 && (
        <section className="mt-6">
          <h2 className="type-eyebrow mb-3 text-steel-500">Add a batter</h2>
          <div className="flex flex-wrap gap-2">
            {missing.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => addBatter(p)}
                className="flex min-h-11 items-center gap-2 bg-ink-900 px-3 py-2 text-sm text-steel-200 ring-1 ring-inset ring-white/10 hover:bg-ink-800"
              >
                <JerseyNumber value={p.jerseyNumber} size="sm" tone="ghost" />
                {p.displayName}
              </button>
            ))}
          </div>
        </section>
      )}

      <div className="mt-5 flex flex-wrap items-center justify-between gap-4">
        <p className="max-w-prose border-l-[3px] border-steel-700 pl-4 text-xs leading-relaxed text-steel-500">
          Every number here normally comes from the plays recorded during the game. Type
          over one and that column is yours until you put it back; the rest keep deriving.
          Corrected lines flow straight through to season and career totals. The team score
          is not affected — that comes from the linescore, on the scorebook.
        </p>

        {editable && correctedCount > 0 && (
          <AdminButton type="button" onClick={revertAll} disabled={pending}>
            Revert all {correctedCount} {correctedCount === 1 ? 'line' : 'lines'}
          </AdminButton>
        )}
      </div>
    </div>
  );
}

/**
 * One number.
 *
 * Committed on blur rather than per keystroke: every save is a round trip, and
 * typing "12" should not briefly save a 1.
 */
function StatCell({
  value,
  derived,
  disabled,
  label,
  onCommit,
}: {
  value: number | null;
  derived: number;
  disabled: boolean;
  label: string;
  onCommit: (value: number | null) => void;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const shown = draft ?? String(value ?? derived);
  const corrected = value !== null;

  const commit = () => {
    if (draft === null) return;
    const trimmed = draft.trim();
    setDraft(null);

    // An emptied cell goes back to deriving.
    if (trimmed === '') {
      if (corrected) onCommit(null);
      return;
    }

    const parsed = Number(trimmed);
    if (!Number.isFinite(parsed) || parsed < 0) return;
    if (parsed === value) return;
    onCommit(Math.round(parsed));
  };

  return (
    <span className="inline-flex flex-col items-center">
      <input
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        value={shown}
        disabled={disabled}
        aria-label={label}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.currentTarget.blur();
          if (e.key === 'Escape') setDraft(null);
        }}
        className={cn(
          'num-table h-11 w-11 bg-ink-800 text-center text-sm ring-1 ring-inset',
          'focus:outline-none focus:ring-2 focus:ring-gold-400 disabled:opacity-50',
          corrected ? 'text-gold-400 ring-gold-400/40' : 'text-white ring-white/10',
        )}
      />
      {/* What the plays counted, kept visible so reverting holds no surprise. */}
      <span className="num-table mt-0.5 h-3 text-[9px] leading-none text-steel-600">
        {corrected && value !== derived ? derived : ''}
      </span>
    </span>
  );
}
