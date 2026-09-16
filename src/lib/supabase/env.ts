/** Centralised, validated access to Supabase environment configuration. */

function required(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(
      `Missing environment variable ${name}.\n` +
        `  Local:  copy .env.example to .env.local and fill it in.\n` +
        `  Vercel: Project Settings > Environment Variables, for Production, ` +
        `Preview and Development, then redeploy.\n` +
        `  Values are at: Supabase Dashboard > Project Settings > API.`,
    );
  }
  return value;
}

export const SUPABASE_URL = () =>
  required('NEXT_PUBLIC_SUPABASE_URL', process.env.NEXT_PUBLIC_SUPABASE_URL);

export const SUPABASE_PUBLISHABLE_KEY = () =>
  required(
    'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY',
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  );

/** Server-only. Never import this from a client component. */
export const SUPABASE_SECRET_KEY = () =>
  required('SUPABASE_SECRET_KEY', process.env.SUPABASE_SECRET_KEY);
