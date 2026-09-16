import { NextResponse } from 'next/server';
import { supabasePublishableKey, supabaseUrl } from '@/lib/supabase/env';

/**
 * Deployment health and configuration check.
 *
 * Deliberately has no dependency on the database layer, so it answers even
 * when the app is misconfigured - which is exactly when you need it.
 *
 * Configuration is read at request time, so this reflects what the running
 * deployment can see right now, and `from` names the variable that supplied
 * each value - which makes a misnamed or wrong-environment variable obvious.
 *
 * No secrets are revealed. The Supabase URL and publishable key are public by
 * design (they ship in the browser bundle), and the key is still reported as a
 * short prefix rather than in full. The service key is reported only as
 * present or absent.
 */

export const dynamic = 'force-dynamic';

export async function GET() {
  const url = supabaseUrl();
  const publishableKey = supabasePublishableKey();

  // Which variable name actually supplied the value, so a misnamed or
  // wrong-environment variable is obvious rather than just "missing".
  const source = (...names: string[]) => names.find((n) => process.env[n]) ?? null;

  const config = {
    supabaseUrl: url
      ? {
          configured: true,
          host: safeHost(url),
          from: source('SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_URL'),
        }
      : { configured: false },
    supabasePublishableKey: publishableKey
      ? {
          configured: true,
          prefix: `${publishableKey.slice(0, 12)}…`,
          from: source('SUPABASE_PUBLISHABLE_KEY', 'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY'),
        }
      : { configured: false },
    supabaseSecretKey: { configured: Boolean(process.env.SUPABASE_SECRET_KEY) },
  };

  const ready = Boolean(url && publishableKey);

  // Round-trip a trivial public read, so a green check means the database is
  // genuinely reachable and readable by an anonymous visitor.
  let database: { reachable: boolean; status?: number; error?: string } = { reachable: false };

  if (ready) {
    try {
      const res = await fetch(`${url}/rest/v1/positions?select=code&limit=1`, {
        headers: { apikey: publishableKey!, accept: 'application/json' },
        cache: 'no-store',
        signal: AbortSignal.timeout(5000),
      });
      database = res.ok
        ? { reachable: true, status: res.status }
        : { reachable: false, status: res.status };
    } catch (err) {
      database = { reachable: false, error: (err as Error).message };
    }
  }

  const ok = ready && database.reachable;

  return NextResponse.json(
    {
      ok,
      config,
      database,
      build: {
        commit: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? null,
        branch: process.env.VERCEL_GIT_COMMIT_REF ?? null,
        environment: process.env.VERCEL_ENV ?? 'local',
      },
      ...(ok
        ? {}
        : {
            hint: ready
              ? 'Configuration is present but the database could not be read. Check the Supabase project is running and the publishable key belongs to it.'
              : 'This deployment cannot see SUPABASE_URL / SUPABASE_PUBLISHABLE_KEY (nor their NEXT_PUBLIC_ equivalents). These are read at request time, so set them for this environment and redeploy - no rebuild needed. If they are already set, confirm they are on THIS project and ticked for this environment.',
          }),
    },
    { status: ok ? 200 : 503 },
  );
}

function safeHost(value: string): string | null {
  try {
    return new URL(value).host;
  } catch {
    return null;
  }
}
