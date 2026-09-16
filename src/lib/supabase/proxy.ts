import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import type { Database } from './database.types';
import { supabasePublishableKey, supabaseUrl } from './env';

/**
 * Refreshes the auth session on every request and gates /admin.
 *
 * Runs from the `proxy` file convention (what Next called `middleware` before
 * 16). This is a convenience layer, not the security boundary: row level
 * security is what actually protects the data, so a request that slips past
 * this still cannot read or write anything the user is not entitled to.
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const url = supabaseUrl();
  const key = supabasePublishableKey();

  // Throwing here would turn a configuration mistake into an opaque 500 on
  // EVERY route, because this runs before anything else. Pass the request
  // through instead: pages then surface the specific error, which names the
  // variable and where to set it. Nothing is exposed by allowing it - row
  // level security, not this function, is what protects the data.
  if (!url || !key) {
    console.error(
      'Supabase is not configured for this deployment. Set SUPABASE_URL and ' +
        'SUPABASE_PUBLISHABLE_KEY (or their NEXT_PUBLIC_ equivalents). ' +
        'See /api/health for what this deployment can actually see.',
    );
    return response;
  }

  const supabase = createServerClient<Database>(
    url,
    key,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          response = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
        },
      },
    },
  );

  // getUser() revalidates the token with Supabase; getSession() would trust
  // whatever the cookie claims.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  const isAdminRoute = pathname.startsWith('/admin');
  const isLoginRoute = pathname === '/login';

  if (isAdminRoute && !user) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('next', pathname);
    return NextResponse.redirect(url);
  }

  if (isLoginRoute && user) {
    const url = request.nextUrl.clone();
    url.pathname = '/admin';
    url.search = '';
    return NextResponse.redirect(url);
  }

  return response;
}
