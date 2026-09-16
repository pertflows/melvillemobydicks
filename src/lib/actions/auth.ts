'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';

const credentials = z.object({
  email: z.email('Enter a valid email address.'),
  password: z.string().min(1, 'Enter your password.'),
  // formData.get() yields null when the field is absent, which happens whenever
  // someone opens /login directly rather than being redirected to it.
  next: z.string().nullish(),
});

export interface AuthState {
  error?: string;
}

export async function signIn(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const parsed = credentials.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
    next: formData.get('next'),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Check your details and try again.' };
  }

  const db = await createClient();
  const { error } = await db.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });

  if (error) {
    // Deliberately vague: do not reveal whether the address has an account.
    return { error: 'Those credentials were not recognised.' };
  }

  revalidatePath('/', 'layout');

  // Only ever redirect to a path on this site, never to an absolute URL.
  const next = parsed.data.next;
  const safeNext = next && next.startsWith('/') && !next.startsWith('//') ? next : '/admin';
  redirect(safeNext);
}

export async function signOut() {
  const db = await createClient();
  await db.auth.signOut();
  revalidatePath('/', 'layout');
  redirect('/login');
}
