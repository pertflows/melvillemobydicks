# Architecture

## The one rule

**Statistics are never stored. They are derived.**

There is no `players.batting_average` column, no nightly job that recomputes
totals, and nothing that increments a counter when a game ends. Every number on
the site is a view over the play-by-play log:

```
player
  └─ season roster membership        player_seasons
       └─ game                       games
            └─ lineup                game_lineups / game_lineup_players
                 └─ plate appearance plate_appearances
                      └─ result      pa_result_types
                      └─ runners     base_runner_movements
                           ↓
                      player_game_stats     (view)
                           ↓
                      player_season_stats   (view)  + legacy_stat_baselines
                           ↓
                      player_career_stats   (view)
```

Correcting a play from three weeks ago fixes that player's season average, the
team's run differential, and the leaderboards, because none of them were ever
written down.

## Why result types live in a table

`pa_result_types` holds one row per outcome with the flags that decide what it
means statistically: `counts_as_ab`, `is_hit`, `total_bases`, `is_walk`,
`is_sac_fly`, and so on. The stat views join to it rather than carrying a
`CASE WHEN result_code IN (...)` expression.

Adding stolen bases, catcher's interference or a new out type is an `INSERT`
plus, at most, one column in one view. It is not a rewrite of the stat engine.

## Legacy statistics

The old site published `AVG HR RBI H BB G` and nothing else. It never published
at-bats or plate appearances, so a true batting average cannot be reconstructed
from it.

`legacy_stat_baselines` stores exactly what was published and leaves the rest
`NULL`. **At-bats are not back-computed from the average** - doing that would
invent plate appearances that exist in no record.

`player_season_stats` combines a season's derived stats with its baseline and
reports how it got each rate:

| `batting_average_basis` | Meaning |
|---|---|
| `computed` | At-bats known for every contributing source. `batting_average` is real. |
| `legacy_override` | Only legacy data; shows the figure the old site displayed. |
| `derived_partial` | Both exist but legacy at-bats are unknown, so a combined rate would be a guess. `batting_average` is `NULL`. |

OBP and SLG are only produced when the inputs are genuinely known; otherwise
they are `NULL` rather than approximated. The public stats page says so in
plain language instead of quietly presenting inherited numbers as computed.

Filling in `at_bats` for a season - from a paper scorebook, through the admin
Baseline editor - flips that season to `computed` with no code change.

## Scoring

`src/lib/scoring/engine.ts` is pure: no database, no React. It does two things.

**`defaultAdvancement(result, bases, batterId)`** returns the runner movements
an outcome normally produces, which is what makes one-tap scoring possible. A
home run scores everybody; a walk advances only forced runners; a run that
scores on an error is a run but not an RBI.

**`replayGame(log)`** folds the play log into the current inning, outs, base
occupancy, score and batting position. Nothing about live game state is stored
and mutated, which is why **undo is just a delete** of the last appearance.

The same functions run in the browser and on the server, so the scorebook can
apply a play optimistically the instant it is tapped and know the stored result
will match. Writes are serialised because `recordPlay` derives its sequence
number from the current maximum.

`tests/scoring-engine.test.mts` covers the advancement rules and the replay
(`npm test`).

## Security

Row level security is the boundary, not the UI.

- Public read on published content; every write requires a role.
- `admin` may change anything; `scorekeeper` may only write live game data
  (plays, runners, events, innings, lineups); everyone else is read-only.
- `is_admin()` / `can_score()` are `SECURITY DEFINER` so policies can consult
  `profiles` without recursing, and `EXECUTE` is revoked from `anon`.
- Middleware redirects unauthenticated visitors away from `/admin`, but that is
  convenience. A forged request that skips it still fails at the database.

Verified against the live API: anonymous `INSERT` into `seasons` and `players`
is rejected with `42501`, and `rpc/is_admin` is `permission denied`.

## Layout

```
src/
  app/
    (public)/        the public site
    admin/           admin + scorebook  (protected)
    login/
  components/
    sports/          the shared sports graphics language
    site/            public chrome
    admin/           admin chrome
    home/            homepage sections
  lib/
    supabase/        client (browser) / server (cookies) / static (build) / admin (service key)
    queries/         all reads. Components never build queries.
    actions/         all writes, as server actions. Each re-checks role.
    scoring/         the pure engine
    images/          shared HEIC/WebP processing
    legacy/          the importer: fetch, parse, load, verify
    stats/           pure leaderboard sorting (client-safe)
scripts/             import-legacy, create-admin
supabase/migrations/ schema, RLS, views
tests/
```

Data access is confined to `lib/queries` and `lib/actions`. A page never calls
Supabase directly. Pure logic that a client component needs (leaderboard
sorting, the scoring engine, formatting) lives outside `lib/queries` so that
importing it does not drag `next/headers` into the browser bundle.

## Seasons

Nothing hardcodes a year. A season is a year plus an optional session label
(`2027 Spring`, `2027 Fall`), `getCurrentSeason()` falls back to the most recent
season if nobody set the flag, and the importer derives seasons from the data it
finds.

## Known gaps

- **Pitching statistics** are not implemented. The schema is shaped for them:
  `plate_appearances` already records the batting team and the result taxonomy
  is data, so a `pitching_appearances` table and a parallel view can be added
  without touching what exists.
- **Opponent batters** are not scored individually. `plate_appearances.batting_team`
  exists for it; today the opponent's runs are entered per inning.
- **Substitutions** are modelled (`game_lineup_players.is_starter`,
  `entered_inning`, `exited_inning`) but the scorebook UI does not yet expose them.
- **Realtime** is enabled at the database but the public live view polls via
  revalidation rather than subscribing.
