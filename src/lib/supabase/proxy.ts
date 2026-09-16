import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import type { Database } from './database.types';

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

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  // NEXT_PUBLIC_* values are inlined at build time, so a deployment built
  // before they were configured has them frozen as undefined - adding them
  // afterwards changes nothing until a fresh build runs.
  //
  // Throwing here would turn that into an opaque 500 on EVERY route, because
  // this runs before anything else. Pass the request through instead: pages
  // then surface the specific "missing environment variable" error, which
  // names the variable and where to set it. Nothing is exposed by doing so -
  // row level security, not this function, is what protects the data.
  if (!url || !key) {
    console.error(
      'Supabase environment variables are missing from this build. ' +
        'Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, ' +
        'then trigger a NEW build - redeploying from the existing build cache ' +
        'will keep the old inlined values.',
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
