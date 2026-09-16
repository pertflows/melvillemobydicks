import { NextResponse } from 'next/server';

/**
 * Deployment health and configuration check.
 *
 * Deliberately has no dependency on the database layer, so it answers even
 * when the app is misconfigured - which is exactly when you need it.
 *
 * NEXT_PUBLIC_* values are inlined at build time, so "configured" here means
 * the variable was present in the environment that ran `next build`, not that
 * it currently exists in the dashboard. That distinction is the usual cause of
 * a deployment that fails after the variables were apparently set: adding them
 * afterwards has no effect until a NEW build runs, and redeploying from the
 * existing build cache reuses the old inlined values.
 *
 * No secrets are revealed. The Supabase URL and publishable key are public by
 * design (they ship in the browser bundle), and the key is still reported as a
 * short prefix rather than in full. The service key is reported only as
 * present or absent.
 */

export const dynamic = 'force-dynamic';

export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  const config = {
    supabaseUrl: url ? { configured: true, host: safeHost(url) } : { configured: false },
    supabasePublishableKey: publishableKey
      ? { configured: true, prefix: `${publishableKey.slice(0, 12)}…` }
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
              : 'Supabase variables were missing when this build ran. NEXT_PUBLIC_* values are baked in at build time, so set them and then trigger a NEW build - a redeploy that reuses the existing build cache will keep the old empty values.',
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
