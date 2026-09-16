/**
 * Supabase configuration, read at RUNTIME.
 *
 * Every Supabase call in this app happens on the server, so the configuration
 * does not need to be inlined into the browser bundle. That matters: values
 * prefixed `NEXT_PUBLIC_` are frozen at build time, so setting them after a
 * deployment has no effect until a whole new build runs, and a redeploy from
 * the build cache silently keeps the old ones.
 *
 * Reading unprefixed variables instead means the values are looked up per
 * request. Change them in your host's dashboard, redeploy, and they take
 * effect - no rebuild required.
 *
 * `NEXT_PUBLIC_*` is still accepted as a fallback so existing setups keep
 * working. Anything that genuinely runs in the browser (Realtime, for example)
 * would need the prefixed form, since only that can reach the client.
 */

function read(...names: string[]): string | undefined {
  for (const name of names) {
    const value = process.env[name];
    if (value) return value;
  }
  return undefined;
}

function required(value: string | undefined, names: string[]): string {
  if (!value) {
    throw new Error(
      `Missing environment variable ${names[0]} (or ${names[1]}).\n` +
        `  Local:  copy .env.example to .env.local and fill it in.\n` +
        `  Vercel: Project Settings > Environment Variables, ticked for the\n` +
        `          environment you are deploying, then redeploy.\n` +
        `  Values are at: Supabase Dashboard > Project Settings > API.\n` +
        `  Check what the running deployment can actually see at /api/health.`,
    );
  }
  return value;
}

const URL_NAMES = ['SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_URL'];
const KEY_NAMES = ['SUPABASE_PUBLISHABLE_KEY', 'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY'];

export const supabaseUrl = () => read(...URL_NAMES);
export const supabasePublishableKey = () => read(...KEY_NAMES);

export const SUPABASE_URL = () => required(supabaseUrl(), URL_NAMES);
export const SUPABASE_PUBLISHABLE_KEY = () => required(supabasePublishableKey(), KEY_NAMES);

/** Server-only. Never import this from a client component. */
export const SUPABASE_SECRET_KEY = () => {
  const value = process.env.SUPABASE_SECRET_KEY;
  if (!value) {
    throw new Error(
      'Missing environment variable SUPABASE_SECRET_KEY.\n' +
        '  Only the importer and create-admin scripts need it.\n' +
        '  Find it at: Supabase Dashboard > Project Settings > API keys > service_role.',
    );
  }
  return value;
};
