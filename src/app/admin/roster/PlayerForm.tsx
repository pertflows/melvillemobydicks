'use client';

import { useActionState, useState } from 'react';
import { useFormStatus } from 'react-dom';
import Image from 'next/image';
import { savePlayer, type ActionState } from '@/lib/actions/roster';
import { AdminButton } from '@/components/admin/AdminPage';
import type { AdminPlayerRow } from '@/lib/queries/admin';

interface Position {
  code: string;
  label: string;
}

export function PlayerForm({
  player,
  positions,
  seasonId,
  onDone,
}: {
  player?: AdminPlayerRow;
  positions: Position[];
  seasonId: string;
  onDone?: () => void;
}) {
  const [state, action] = useActionState<ActionState, FormData>(savePlayer, {});
  const [preview, setPreview] = useState<string | null>(player?.photoUrl ?? null);

  return (
    <form action={action} className="space-y-5">
      <input type="hidden" name="seasonId" value={seasonId} />
      {player && <input type="hidden" name="id" value={player.id} />}

      <div className="grid gap-4 sm:grid-cols-2">
        <Text label="First name" name="firstName" defaultValue={player?.firstName} required />
        <Text label="Last name" name="lastName" defaultValue={player?.lastName} required />
      </div>

      <Text
        label="Display name"
        name="displayName"
        defaultValue={player?.displayName}
        hint="Leave blank to use first and last name."
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <Text
          label="Jersey number"
          name="jerseyNumber"
          type="number"
          min={0}
          max={99}
          defaultValue={player?.jerseyNumber ?? ''}
        />

        <Select
          label="Primary position"
          name="primaryPosition"
          defaultValue={player?.position ?? ''}
          options={positions.map((p) => ({ value: p.code, label: p.label }))}
        />

        <Select
          label="Status"
          name="status"
          defaultValue={player?.status ?? 'active'}
          options={[
            { value: 'active', label: 'Active' },
            { value: 'inactive', label: 'Inactive' },
            { value: 'alumni', label: 'Alumni' },
          ]}
          hint="Players are never deleted."
        />
      </div>

      <fieldset>
        <legend className="type-eyebrow mb-2 text-steel-400">Secondary positions</legend>
        <div className="flex flex-wrap gap-2">
          {positions.map((p) => (
            <label
              key={p.code}
              className="cursor-pointer bg-ink-800 px-3 py-1.5 text-xs text-steel-300 ring-1 ring-inset ring-white/10 has-checked:bg-gold-400 has-checked:text-navy-950"
            >
              <input
                type="checkbox"
                name="secondaryPositions"
                value={p.code}
                className="sr-only"
              />
              {p.code}
            </label>
          ))}
        </div>
      </fieldset>

      <div>
        <label htmlFor="bio" className="type-eyebrow mb-2 block text-steel-400">
          Biography
        </label>
        <textarea
          id="bio"
          name="bio"
          rows={6}
          defaultValue={player?.bio ?? ''}
          className="w-full bg-ink-800 px-4 py-3 text-sm leading-relaxed text-white ring-1 ring-inset ring-white/10 focus:ring-2 focus:ring-navy-400"
        />
        <p className="mt-1.5 text-xs text-steel-600">
          Blank lines separate paragraphs.
        </p>
      </div>

      <div>
        <label htmlFor="photo" className="type-eyebrow mb-2 block text-steel-400">
          Photo
        </label>
        <div className="flex items-start gap-4">
          {preview && (
            <Image
              src={preview}
              alt=""
              width={72}
              height={90}
              className="h-[90px] w-[72px] object-cover object-top ring-1 ring-white/10"
              unoptimized
            />
          )}
          <div className="min-w-0 flex-1">
            <input
              id="photo"
              name="photo"
              type="file"
              accept="image/*,.heic,.heif"
              onChange={(e) => {
                const file = e.target.files?.[0];
                setPreview(file ? URL.createObjectURL(file) : (player?.photoUrl ?? null));
              }}
              className="block w-full text-sm text-steel-400 file:mr-3 file:border-0 file:bg-white/10 file:px-4 file:py-2 file:text-xs file:uppercase file:tracking-widest file:text-white"
            />
            <p className="mt-1.5 text-xs text-steel-600">
              HEIC from an iPhone is fine — it is converted to WebP on upload and the
              original is kept.
            </p>
          </div>
        </div>
      </div>

      {state.error && (
        <p role="alert" className="border-l-[3px] border-loss bg-loss/10 px-4 py-3 text-sm text-white">
          {state.error}
        </p>
      )}
      {state.success && (
        <p role="status" className="border-l-[3px] border-win bg-win/10 px-4 py-3 text-sm text-white">
          {state.success}
        </p>
      )}

      <div className="flex gap-2">
        <Submit />
        {onDone && (
          <button
            type="button"
            onClick={onDone}
            className="type-eyebrow px-4 py-2.5 text-steel-400 hover:text-white"
          >
            Close
          </button>
        )}
      </div>
    </form>
  );
}

function Submit() {
  const { pending } = useFormStatus();
  return (
    <AdminButton type="submit" variant="primary" disabled={pending}>
      {pending ? 'Saving…' : 'Save player'}
    </AdminButton>
  );
}

function Text({
  label, name, defaultValue, type = 'text', hint, required, min, max,
}: {
  label: string; name: string; defaultValue?: string | number; type?: string;
  hint?: string; required?: boolean; min?: number; max?: number;
}) {
  return (
    <div>
      <label htmlFor={name} className="type-eyebrow mb-2 block text-steel-400">
        {label}
      </label>
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
      {hint && <p className="mt-1.5 text-xs text-steel-600">{hint}</p>}
    </div>
  );
}

function Select({
  label, name, defaultValue, options, hint,
}: {
  label: string; name: string; defaultValue?: string;
  options: { value: string; label: string }[]; hint?: string;
}) {
  return (
    <div>
      <label htmlFor={name} className="type-eyebrow mb-2 block text-steel-400">
        {label}
      </label>
      <select
        id={name}
        name={name}
        defaultValue={defaultValue}
        className="w-full bg-ink-800 px-4 py-2.5 text-sm text-white ring-1 ring-inset ring-white/10 focus:ring-2 focus:ring-navy-400"
      >
        <option value="">—</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      {hint && <p className="mt-1.5 text-xs text-steel-600">{hint}</p>}
    </div>
  );
}
