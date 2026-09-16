'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { saveLegacyBaseline, type ActionState } from '@/lib/actions/roster';
import { AdminButton } from '@/components/admin/AdminPage';
import type { AdminPlayerRow } from '@/lib/queries/admin';

/**
 * Editor for an imported legacy stat baseline.
 *
 * At-bats is the important field: while it is blank the season's average is the
 * number the old site displayed, and OBP/SLG cannot be produced at all. Fill it
 * in and the rate stats become genuinely computed, with no code change.
 */
export function LegacyBaselineForm({
  player,
  seasonId,
  seasonName,
  onDone,
}: {
  player: AdminPlayerRow;
  seasonId: string;
  seasonName: string;
  onDone: () => void;
}) {
  const [state, action] = useActionState<ActionState, FormData>(saveLegacyBaseline, {});
  const b = player.legacyBaseline;

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="playerId" value={player.id} />
      <input type="hidden" name="seasonId" value={seasonId} />

      <div>
        <h3 className="type-eyebrow text-steel-300">
          {player.displayName} — {seasonName} legacy baseline
        </h3>
        <p className="mt-2 max-w-2xl text-xs leading-relaxed text-steel-500">
          These are the figures the previous site published. At-bats were never
          published, so they are recorded as unknown rather than derived from the
          average. Enter them from the scorebook and this season&rsquo;s AVG, OBP and
          SLG become computed instead of inherited.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
        <Num label="G" name="games" value={b?.games} />
        <Num label="H" name="hits" value={b?.hits} />
        <Num label="HR" name="homeRuns" value={b?.homeRuns} />
        <Num label="RBI" name="rbi" value={b?.rbi} />
        <Num label="BB" name="walks" value={b?.walks} />
        <Num label="AB" name="atBats" value={b?.atBats} highlight />
        <Num
          label="AVG"
          name="battingAverageOverride"
          value={b?.battingAverageOverride}
          step="0.0001"
        />
      </div>

      <div>
        <label htmlFor={`notes-${player.id}`} className="type-eyebrow mb-2 block text-steel-400">
          Notes
        </label>
        <textarea
          id={`notes-${player.id}`}
          name="notes"
          rows={2}
          defaultValue={b?.notes ?? ''}
          className="w-full bg-ink-800 px-3 py-2 text-xs text-steel-300 ring-1 ring-inset ring-white/10 focus:ring-2 focus:ring-navy-400"
        />
      </div>

      {state.error && (
        <p role="alert" className="border-l-[3px] border-loss bg-loss/10 px-3 py-2 text-sm text-white">
          {state.error}
        </p>
      )}
      {state.success && (
        <p role="status" className="border-l-[3px] border-win bg-win/10 px-3 py-2 text-sm text-white">
          {state.success}
        </p>
      )}

      <div className="flex gap-2">
        <Submit />
        <button type="button" onClick={onDone} className="type-eyebrow px-3 py-2 text-steel-400 hover:text-white">
          Close
        </button>
      </div>
    </form>
  );
}

function Submit() {
  const { pending } = useFormStatus();
  return (
    <AdminButton type="submit" variant="primary" disabled={pending}>
      {pending ? 'Saving…' : 'Save baseline'}
    </AdminButton>
  );
}

function Num({
  label, name, value, step, highlight,
}: {
  label: string; name: string; value?: number | null; step?: string; highlight?: boolean;
}) {
  const id = `${name}-${label}`;
  return (
    <div>
      <label htmlFor={id} className={`type-eyebrow mb-1.5 block text-[10px] ${highlight ? 'text-gold-400' : 'text-steel-500'}`}>
        {label}
      </label>
      <input
        id={id}
        name={name}
        type="number"
        step={step ?? '1'}
        min={0}
        defaultValue={value ?? ''}
        placeholder="—"
        className="num-table w-full bg-ink-800 px-2.5 py-2 text-white ring-1 ring-inset ring-white/10 placeholder:text-steel-700 focus:ring-2 focus:ring-navy-400"
      />
    </div>
  );
}
