#!/usr/bin/env tsx
/**
 * Creates (or promotes) an admin user.
 *
 *   npx tsx scripts/create-admin.ts <email> [password]
 *
 * If the account already exists it is promoted to the admin role rather than
 * recreated. When no password is given, one is generated and printed once.
 *
 * Requires SUPABASE_SECRET_KEY, because creating users and assigning roles are
 * exactly the privileged operations row level security reserves.
 */

import { randomBytes } from 'node:crypto';
import { config as loadEnv } from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '../src/lib/supabase/database.types';

loadEnv({ path: '.env.local', quiet: true });
loadEnv({ quiet: true });

const [email, passwordArg] = process.argv.slice(2);

if (!email) {
  console.error('Usage: npx tsx scripts/create-admin.ts <email> [password]');
  process.exit(1);
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SECRET_KEY;

if (!url || !key) {
  console.error(
    'Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SECRET_KEY.\n' +
      'The service_role key is at: Dashboard > Project Settings > API keys.',
  );
  process.exit(1);
}

const password = passwordArg ?? randomBytes(15).toString('base64url');
const db = createClient<Database>(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function main() {
  // Look for an existing account before creating one.
  const { data: list, error: listError } = await db.auth.admin.listUsers({ perPage: 1000 });
  if (listError) throw new Error(`listUsers: ${listError.message}`);

  const existing = list.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
  let userId = existing?.id;
  let created = false;

  if (!userId) {
    const { data, error } = await db.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    if (error) throw new Error(`createUser: ${error.message}`);
    userId = data.user.id;
    created = true;
  } else if (passwordArg) {
    const { error } = await db.auth.admin.updateUserById(userId, { password });
    if (error) throw new Error(`updateUser: ${error.message}`);
  }

  // The handle_new_user trigger creates the profile; make sure it is an admin.
  const { error: roleError } = await db
    .from('profiles')
    .upsert({ id: userId!, email, role: 'admin' }, { onConflict: 'id' });
  if (roleError) throw new Error(`profiles: ${roleError.message}`);

  console.log(`\n${created ? 'Created' : 'Promoted'} admin: ${email}`);
  if (created || passwordArg) {
    console.log(`Password: ${password}`);
    if (!passwordArg) console.log('(generated - change it after signing in)');
  } else {
    console.log('Existing password left unchanged.');
  }
  console.log('\nSign in at /login\n');
}

main().catch((err) => {
  console.error('\nFailed:', err.message);
  process.exit(1);
});
