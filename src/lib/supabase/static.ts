import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import type { Database } from './database.types';
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from './env';

/**
 * Cookieless anonymous client.
 *
 * `generateStaticParams` and other build-time work run without an HTTP request,
 * so they cannot use the cookie-bound server client. This one carries only the
 * publishable key, so it sees exactly what an anonymous visitor sees - which is
 * the right scope for deciding which pages to pre-render.
 */
export function createStaticClient() {
  return createSupabaseClient<Database>(SUPABASE_URL(), SUPABASE_PUBLISHABLE_KEY(), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
