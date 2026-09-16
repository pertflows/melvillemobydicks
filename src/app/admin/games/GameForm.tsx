'use client';

import { useActionState, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { saveGame, type ActionState } from '@/lib/actions/games';
import { AdminButton } from '@/components/admin/AdminPage';

interface Option { id: string; label: string }

export interface GameFormValues {
  id?: string;
  opponentId?: string | null;
  venueId?: string | null;
  date: string;
  time: string;
  homeAway: 'home' | 'away';
  gameNumber: number;
  scheduledInnings: number;
  status: string;
  ourRuns: number | null;
  theirRuns: number | null;
  notes: string | null;
}

export function GameForm({
  seasonId,
  opponents,
  venues,
  values,
}: {
  seasonId: string;
  opponents: Option[];
  venues: Option[];
  values: GameFormValues;
}) {
  const [state, action] = useActionState<ActionState, FormData>(saveGame, {});
  const [status, setStatus] = useState(values.status);

  const showScore = status === 'final' || status === 'live';

  return (
    <form action={action} className="space-y-5">
      <input type="hidden" name="seasonId" value={seasonId} />
      {values.id && <input type="hidden" name="id" value={values.id} />}

      <div className="grid gap-4 sm:grid-cols-2">
        <Combo
          label="Opponent"
          selectName="opponentId"
          newName="newOpponent"
          options={opponents}
          defaultValue={values.opponentId ?? ''}
          placeholder="New opponent name"
        />
        <Combo
          label="Venue"
          selectName="venueId"
          newName="newVenue"
          options={venues}
          defaultValue={values.venueId ?? ''}
          placeholder="e.g. Cantiague Park - Field D"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-4">
        <Field label="Date" name="date" type="date" defaultValue={values.date} required />
        <Field label="Start time" name="time" type="time" defaultValue={values.time} required />
        <Pick
          label="Home / Away"
          name="homeAway"
          defaultValue={values.homeAway}
          options={[
            { value: 'home', label: 'Home' },
            { value: 'away', label: 'Away' },
          ]}
        />
        <Pick
          label="Game number"
          name="gameNumber"
          defaultValue={String(values.gameNumber)}
          hint="2 for the nightcap"
          options={[1, 2, 3, 4].map((n) => ({ value: String(n), label: String(n) }))}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Pick
          label="Status"
          name="status"
          defaultValue={values.status}
          onChange={setStatus}
          options={[
            { value: 'scheduled', label: 'Scheduled' },
            { value: 'pregame', label: 'Pregame' },
            { value: 'live', label: 'Live' },
            { value: 'final', label: 'Final' },
            { value: 'postponed', label: 'Postponed' },
            { value: 'cancelled', label: 'Cancelled' },
          ]}
        />
        <Field
          label="Innings"
          name="scheduledInnings"
          type="number"
          min={1}
          max={15}
          defaultValue={values.scheduledInnings}
        />
      </div>

      {showScore && (
        <fieldset className="grid gap-4 border-l-[3px] border-steel-700 pl-4 sm:grid-cols-2">
          <legend className="type-eyebrow mb-2 text-steel-400">Recorded score</legend>
          <Field label="Moby Dicks" name="ourRuns" type="number" min={0} defaultValue={values.ourRuns ?? ''} />
          <Field label="Opponent" name="theirRuns" type="number" min={0} defaultValue={values.theirRuns ?? ''} />
          <p className="text-xs text-steel-600 sm:col-span-2">
            Only used for games without play-by-play. Once a game is scored in the
            scorebook, the score is derived from the plays and these are ignored.
          </p>
        </fieldset>
      )}

      <div>
        <label htmlFor="notes" className="type-eyebrow mb-2 block text-steel-400">Notes</label>
        <textarea
          id="notes"
          name="notes"
          rows={3}
          defaultValue={values.notes ?? ''}
          className="w-full bg-ink-800 px-4 py-3 text-sm text-white ring-1 ring-inset ring-white/10 focus:ring-2 focus:ring-navy-400"
        />
      </div>

      {state.error && (
        <p role="alert" className="border-l-[3px] border-loss bg-loss/10 px-4 py-3 text-sm text-white">{state.error}</p>
      )}
      {state.success && (
        <p role="status" className="border-l-[3px] border-win bg-win/10 px-4 py-3 text-sm text-white">{state.success}</p>
      )}

      <Submit />
    </form>
  );
}

function Submit() {
  const { pending } = useFormStatus();
  return (
    <AdminButton type="submit" variant="primary" disabled={pending}>
      {pending ? 'Saving…' : 'Save game'}
    </AdminButton>
  );
}

/** Select an existing record or type a new one. */
function Combo({
  label, selectName, newName, options, defaultValue, placeholder,
}: {
  label: string; selectName: string; newName: string;
  options: Option[]; defaultValue: string; placeholder: string;
}) {
  const [value, setValue] = useState(defaultValue);

  return (
    <div>
      <label htmlFor={selectName} className="type-eyebrow mb-2 block text-steel-400">{label}</label>
      <select
        id={selectName}
        name={selectName}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className="w-full bg-ink-800 px-4 py-2.5 text-sm text-white ring-1 ring-inset ring-white/10 focus:ring-2 focus:ring-navy-400"
      >
        <option value="">— Add new —</option>
        {options.map((o) => (
          <option key={o.id} value={o.id}>{o.label}</option>
        ))}
      </select>
      {value === '' && (
        <input
          name={newName}
          placeholder={placeholder}
          className="mt-2 w-full bg-ink-800 px-4 py-2.5 text-sm text-white ring-1 ring-inset ring-white/10 focus:ring-2 focus:ring-navy-400"
        />
      )}
    </div>
  );
}

function Field({
  label, name, type = 'text', defaultValue, required, min, max,
}: {
  label: string; name: string; type?: string; defaultValue?: string | number;
  required?: boolean; min?: number; max?: number;
}) {
  return (
    <div>
      <label htmlFor={name} className="type-eyebrow mb-2 block text-steel-400">{label}</label>
      <input
        id={name}
        name={name}
        type={type}
        min={min}
        max={max}
        required={required}
        defaultValue={defaultValue}
        className="w-full bg-ink-800 px-4 py-2.5 text-sm text-white ring-1 ring-inset ring-white/10 focus:ring-2 focus:ring-navy-400"
      />
    </div>
  );
}

function Pick({
  label, name, defaultValue, options, hint, onChange,
}: {
  label: string; name: string; defaultValue: string;
  options: { value: string; label: string }[]; hint?: string;
  onChange?: (v: string) => void;
}) {
  return (
    <div>
      <label htmlFor={name} className="type-eyebrow mb-2 block text-steel-400">{label}</label>
      <select
        id={name}
        name={name}
        defaultValue={defaultValue}
        onChange={(e) => onChange?.(e.target.value)}
        className="w-full bg-ink-800 px-4 py-2.5 text-sm text-white ring-1 ring-inset ring-white/10 focus:ring-2 focus:ring-navy-400"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
      {hint && <p className="mt-1.5 text-xs text-steel-600">{hint}</p>}
    </div>
  );
}
