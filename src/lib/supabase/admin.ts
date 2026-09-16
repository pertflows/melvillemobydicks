import 'server-only';

import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import type { Database } from './database.types';
import { SUPABASE_SECRET_KEY, SUPABASE_URL } from './env';

/**
 * Privileged client that bypasses row level security.
 *
 * Only for server-side work that legitimately acts outside a user session:
 * the legacy importer and storage maintenance. Never reach for this to "make
 * a query work" - if a signed-in admin should be able to do it, fix the policy.
 */
export function createAdminClient() {
  return createSupabaseClient<Database>(SUPABASE_URL(), SUPABASE_SECRET_KEY(), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
