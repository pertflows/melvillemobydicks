# The Melville Moby Dicks

The official site and internal system for the Melville Moby Dicks softball club.

It is two products sharing a database: a public site built to look like a
professional sports team's, and a real scorekeeping and statistics application
the team runs from the dugout.

- **Public** — roster, schedule, results, statistics, Captain's Log, media.
- **Admin** — roster and schedule management, editorial, and a phone-first live
  scorebook that records the game one plate appearance at a time.

## Stack

Next.js 16 (App Router, React Server Components) · TypeScript · Tailwind CSS v4 ·
Supabase (Postgres, Auth, Storage, Realtime) · Motion · deployed on Vercel.

## Getting started

```bash
npm install
cp .env.example .env.local     # fill in your Supabase project details
npm run dev
```

Environment variables:

| Variable | Needed for |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | everything |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | everything |
| `SUPABASE_SECRET_KEY` | the importer and `create-admin` only — never sent to the browser |
| `LEGACY_BASE_URL` | the importer (defaults to `https://mobydicks.org`) |

## Database

Migrations are in `supabase/migrations`, applied in filename order:

```bash
supabase db push
```

## Creating an admin

```bash
npm run create:admin -- you@example.com          # generates a password
npm run create:admin -- you@example.com 'secret' # sets one
```

Existing accounts are promoted rather than recreated. Sign in at `/login`.

## Migrating the old site

```bash
npm run import:legacy -- all          # crawl, load, verify
npm run import:legacy -- crawl        # snapshot only, no database writes
npm run import:legacy -- load --skip-media
npm run import:legacy -- verify       # compare the database against the source
```

The import is idempotent — everything is keyed on `legacy_id`, so re-running
reconciles rather than duplicating. `verify` re-reads what was written and
compares it field by field against the live legacy site, including that
unknown at-bats stayed unknown.

Images are copied into our own storage: originals are kept privately and WebP is
generated for delivery. HEIC from iPhones is converted (the originals on the old
site are subtly malformed and need libheif's WASM decoder rather than sharp's
bundled one — `src/lib/images/process.ts` explains why).

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | development server |
| `npm run build` | production build |
| `npm test` | scoring engine tests |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint |
| `npm run import:legacy` | legacy site migration |
| `npm run create:admin` | create or promote an admin |

## Deployment (Vercel)

Set these under *Project Settings > Environment Variables*, ticked for the
environments you deploy (Production and Preview):

| Variable | Notes |
|---|---|
| `SUPABASE_URL` | `https://<ref>.supabase.co` |
| `SUPABASE_PUBLISHABLE_KEY` | the publishable / anon key — safe in the browser |
| `SUPABASE_SECRET_KEY` | optional, and only if you run the importer from CI; **never** expose it client-side |

These are read **at request time**, so changing them takes effect on a redeploy
— no rebuild, and a cached redeploy is fine. `next build` itself needs no
configuration at all and will succeed without any of them.

`NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` still work
as a fallback, but they are inlined at build time, so a deployment built before
they existed keeps the old values until a fresh build runs. Prefer the
unprefixed names.

**Check what a running deployment actually sees at `/api/health`.** It reports
whether each value is present, which variable name supplied it, whether the
database is genuinely reachable, and which commit and branch are serving —
without revealing secrets. It returns 200 when healthy and 503 when not.

Admin sign-in uses email and password, which the server exchanges with Supabase
directly — no redirect is involved, so it works on a new domain with no extra
setup. Set the Site URL and Redirect URLs under *Supabase > Authentication >
URL Configuration* only when you add flows that do redirect: password-reset
emails, magic links or OAuth.

`sharp` and `libheif-js` are runtime dependencies, not dev ones — the admin
photo upload converts HEIC on the server.

## Documentation

- [`docs/DESIGN-SYSTEM.md`](docs/DESIGN-SYSTEM.md) — colour, type, geometry,
  motion, and the sports graphics language.
- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — how statistics are derived,
  how legacy data is preserved honestly, the scoring engine, and the security model.
