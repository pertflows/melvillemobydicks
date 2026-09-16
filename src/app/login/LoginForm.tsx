'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { signIn, type AuthState } from '@/lib/actions/auth';

export function LoginForm({ next }: { next?: string }) {
  const [state, action] = useActionState<AuthState, FormData>(signIn, {});

  return (
    <form action={action} className="space-y-4">
      {next && <input type="hidden" name="next" value={next} />}

      <Field label="Email" name="email" type="email" autoComplete="username" />
      <Field label="Password" name="password" type="password" autoComplete="current-password" />

      {state.error && (
        <p role="alert" className="border-l-[3px] border-loss bg-loss/10 px-4 py-3 text-sm text-white">
          {state.error}
        </p>
      )}

      <SubmitButton />
    </form>
  );
}

function Field({
  label,
  name,
  type,
  autoComplete,
}: {
  label: string;
  name: string;
  type: string;
  autoComplete: string;
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
        required
        autoComplete={autoComplete}
        className="w-full bg-ink-900 px-4 py-3 text-white ring-1 ring-inset ring-white/10 transition-shadow placeholder:text-steel-600 focus:ring-2 focus:ring-navy-400"
      />
    </div>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="type-eyebrow w-full bg-gold-400 px-6 py-3.5 text-navy-950 transition-colors hover:bg-gold-300 disabled:opacity-60"
    >
      {pending ? 'Signing in…' : 'Sign in'}
    </button>
  );
}
