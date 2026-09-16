-- 0005_stat_views
-- Derived statistics. Nothing in this file stores a number; every value is
-- computed from plate_appearances, base_runner_movements and (for imported
-- history) legacy_stat_baselines. Fixing a play fixes every stat downstream.
--
-- All views use security_invoker so row level security on the base tables
-- still applies to whoever is querying.

-- ------------------------------------------------------------ scoreboard --
-- Run totals per game, resolved by precedence:
--   1. derived from runner movements, when the game was scored in-app
--   2. the entered linescore (game_innings)
--   3. the recorded final score (legacy imports)

create view public.game_scoreboard
with (security_invoker = on) as
with derived_runs as (
  select pa.game_id, count(*) filter (where m.scored) as our_runs
  from public.base_runner_movements m
  join public.plate_appearances pa on pa.id = m.plate_appearance_id
  where pa.batting_team = 'us'
  group by pa.game_id
),
inning_runs as (
  select game_id, sum(our_runs)::int as our_runs, sum(their_runs)::int as their_runs
  from public.game_innings
  group by game_id
),
scored_games as (
  select distinct game_id from public.plate_appearances
)
select
  g.id as game_id,
  g.season_id,
  coalesce(
    case when sg.game_id is not null then dr.our_runs end,
    ir.our_runs,
    g.our_runs_recorded
  )::int as our_runs,
  coalesce(ir.their_runs, g.their_runs_recorded)::int as their_runs,
  (sg.game_id is not null) as has_event_data
from public.games g
left join scored_games sg on sg.game_id = g.id
left join derived_runs dr on dr.game_id = g.id
left join inning_runs  ir on ir.game_id = g.id;

-- --------------------------------------------------------- game results --

create view public.game_results
with (security_invoker = on) as
select
  g.id as game_id,
  g.season_id,
  g.starts_at,
  g.status,
  s.our_runs,
  s.their_runs,
  s.has_event_data,
  case
    when g.status <> 'final' or s.our_runs is null or s.their_runs is null then null
    when s.our_runs > s.their_runs then 'W'
    when s.our_runs < s.their_runs then 'L'
    else 'T'
  end as result
from public.games g
join public.game_scoreboard s on s.game_id = g.id;

-- ------------------------------------------------------ team season record --

create view public.team_season_record
with (security_invoker = on) as
select
  season_id,
  count(*) filter (where result = 'W')::int as wins,
  count(*) filter (where result = 'L')::int as losses,
  count(*) filter (where result = 'T')::int as ties,
  count(*) filter (where result is not null)::int as games_played,
  coalesce(sum(our_runs)   filter (where result is not null), 0)::int as runs_scored,
  coalesce(sum(their_runs) filter (where result is not null), 0)::int as runs_allowed
from public.game_results
group by season_id;

-- ------------------------------------------------------- player per game --
-- The atomic derived unit: one row per player per game they appeared in.

create view public.player_game_stats
with (security_invoker = on) as
with pa as (
  select
    p.game_id, g.season_id, p.batter_id as player_id, p.id as pa_id, t.*
  from public.plate_appearances p
  join public.pa_result_types t on t.code = p.result_code
  join public.games g on g.id = p.game_id
  where p.batting_team = 'us' and p.batter_id is not null
),
batting as (
  select
    game_id, season_id, player_id,
    count(*) filter (where counts_as_pa)::int as pa,
    count(*) filter (where counts_as_ab)::int as ab,
    count(*) filter (where is_hit)::int as h,
    count(*) filter (where is_hit and total_bases = 1)::int as singles,
    count(*) filter (where is_hit and total_bases = 2)::int as doubles,
    count(*) filter (where is_hit and total_bases = 3)::int as triples,
    count(*) filter (where is_hit and total_bases = 4)::int as hr,
    coalesce(sum(total_bases) filter (where is_hit), 0)::int as tb,
    count(*) filter (where is_walk)::int as bb,
    count(*) filter (where is_hbp)::int as hbp,
    count(*) filter (where is_strikeout)::int as k,
    count(*) filter (where is_sac_fly)::int as sf,
    count(*) filter (where is_sac_bunt)::int as sac,
    count(*) filter (where is_error)::int as roe,
    count(*) filter (where is_fielders_choice)::int as fc
  from pa
  group by game_id, season_id, player_id
),
runs as (
  select p.game_id, p.season_id, m.runner_id as player_id,
         count(*) filter (where m.scored)::int as r
  from public.base_runner_movements m
  join pa p on p.pa_id = m.plate_appearance_id
  where m.runner_id is not null
  group by p.game_id, p.season_id, m.runner_id
),
rbis as (
  select p.game_id, p.season_id, p.player_id,
         count(*) filter (where m.rbi_credited)::int as rbi
  from public.base_runner_movements m
  join pa p on p.pa_id = m.plate_appearance_id
  group by p.game_id, p.season_id, p.player_id
),
keys as (
  select game_id, season_id, player_id from batting
  union
  select game_id, season_id, player_id from runs
  union
  select game_id, season_id, player_id from rbis
)
select
  k.game_id,
  k.season_id,
  k.player_id,
  coalesce(b.pa, 0)      as pa,
  coalesce(b.ab, 0)      as ab,
  coalesce(r.r, 0)       as r,
  coalesce(b.h, 0)       as h,
  coalesce(b.singles, 0) as singles,
  coalesce(b.doubles, 0) as doubles,
  coalesce(b.triples, 0) as triples,
  coalesce(b.hr, 0)      as hr,
  coalesce(b.tb, 0)      as tb,
  coalesce(rb.rbi, 0)    as rbi,
  coalesce(b.bb, 0)      as bb,
  coalesce(b.hbp, 0)     as hbp,
  coalesce(b.k, 0)       as k,
  coalesce(b.sf, 0)      as sf,
  coalesce(b.sac, 0)     as sac,
  coalesce(b.roe, 0)     as roe,
  coalesce(b.fc, 0)      as fc
from keys k
left join batting b on b.game_id = k.game_id and b.player_id = k.player_id
left join runs    r on r.game_id = k.game_id and r.player_id = k.player_id
left join rbis    rb on rb.game_id = k.game_id and rb.player_id = k.player_id;

-- ----------------------------------------------------- player per season --
--
-- Season totals = event-derived stats + legacy baseline, with explicit honesty
-- about what is computable.
--
--   batting_average         the true combined rate, NULL when not computable
--   batting_average_display best available number for the UI
--   batting_average_basis   'computed' | 'legacy_override' | 'derived_partial'
--
-- 'derived_partial' means the player has both event data and a legacy baseline
-- whose at_bats is unknown, so a combined rate cannot honestly be produced. The
-- moment someone backfills legacy at_bats, the basis flips to 'computed' with
-- no code change.

create view public.player_season_stats
with (security_invoker = on) as
with derived as (
  select
    season_id, player_id,
    count(*)::int as g,
    sum(pa)::int as pa, sum(ab)::int as ab, sum(r)::int as r, sum(h)::int as h,
    sum(singles)::int as singles, sum(doubles)::int as doubles,
    sum(triples)::int as triples, sum(hr)::int as hr, sum(tb)::int as tb,
    sum(rbi)::int as rbi, sum(bb)::int as bb, sum(hbp)::int as hbp,
    sum(k)::int as k, sum(sf)::int as sf, sum(sac)::int as sac
  from public.player_game_stats
  group by season_id, player_id
),
keys as (
  select season_id, player_id from derived
  union
  select season_id, player_id from public.legacy_stat_baselines
),
combined as (
  select
    k.season_id,
    k.player_id,
    (d.season_id is not null) as has_derived,
    (l.id is not null)        as has_legacy,
    coalesce(d.g, 0)   + coalesce(l.games, 0)     as g,
    coalesce(d.h, 0)   + coalesce(l.hits, 0)      as h,
    coalesce(d.hr, 0)  + coalesce(l.home_runs, 0) as hr,
    coalesce(d.rbi, 0) + coalesce(l.rbi, 0)       as rbi,
    coalesce(d.bb, 0)  + coalesce(l.walks, 0)     as bb,
    coalesce(d.r, 0)   + coalesce(l.runs, 0)      as r,
    coalesce(d.doubles, 0) + coalesce(l.doubles, 0) as doubles,
    coalesce(d.triples, 0) + coalesce(l.triples, 0) as triples,
    coalesce(d.k, 0)   as k,
    coalesce(d.sac, 0) as sac,
    coalesce(d.hbp, 0) + coalesce(l.hit_by_pitch, 0)    as hbp,
    coalesce(d.sf, 0)  + coalesce(l.sacrifice_flies, 0) as sf,
    -- Countable only when every contributing source knows the value.
    case when l.id is null or l.at_bats is not null
         then coalesce(d.ab, 0) + coalesce(l.at_bats, 0) end as ab,
    case when l.id is null or l.plate_appearances is not null
         then coalesce(d.pa, 0) + coalesce(l.plate_appearances, 0) end as pa,
    case when l.id is null or l.total_bases is not null
         then coalesce(d.tb, 0) + coalesce(l.total_bases, 0) end as tb,
    d.ab as derived_ab,
    d.h  as derived_h,
    d.tb as derived_tb,
    l.batting_average_override,
    l.at_bats as legacy_at_bats
  from keys k
  left join derived d
    on d.season_id = k.season_id and d.player_id = k.player_id
  left join public.legacy_stat_baselines l
    on l.season_id = k.season_id and l.player_id = k.player_id
)
select
  c.season_id,
  c.player_id,
  c.has_derived,
  c.has_legacy,
  c.g, c.pa, c.ab, c.r, c.h, c.doubles, c.triples, c.hr, c.tb,
  c.rbi, c.bb, c.hbp, c.k, c.sf, c.sac,
  (c.h - c.doubles - c.triples - c.hr) as singles,

  -- True combined rate: only when at-bats are fully known.
  case when c.ab is not null and c.ab > 0
       then round(c.h::numeric / c.ab, 4) end as batting_average,

  case
    when c.ab is not null and c.ab > 0        then round(c.h::numeric / c.ab, 4)
    when c.batting_average_override is not null then c.batting_average_override
    when c.derived_ab is not null and c.derived_ab > 0
                                              then round(c.derived_h::numeric / c.derived_ab, 4)
  end as batting_average_display,

  case
    when c.ab is not null and c.ab > 0          then 'computed'
    when c.batting_average_override is not null and not c.has_derived then 'legacy_override'
    when c.batting_average_override is not null then 'derived_partial'
    when c.derived_ab is not null               then 'computed'
  end as batting_average_basis,

  case when c.ab is not null and (c.ab + c.bb + c.hbp + c.sf) > 0
       then round((c.h + c.bb + c.hbp)::numeric / (c.ab + c.bb + c.hbp + c.sf), 4) end as obp,

  case when c.ab is not null and c.tb is not null and c.ab > 0
       then round(c.tb::numeric / c.ab, 4) end as slg,

  case when c.ab is not null and c.tb is not null and c.ab > 0
            and (c.ab + c.bb + c.hbp + c.sf) > 0
       then round(
              (c.h + c.bb + c.hbp)::numeric / (c.ab + c.bb + c.hbp + c.sf)
              + c.tb::numeric / c.ab, 4) end as ops
from combined c;

-- ------------------------------------------------------- player career --

create view public.player_career_stats
with (security_invoker = on) as
select
  player_id,
  count(*)::int as seasons,
  sum(g)::int as g,
  sum(r)::int as r,
  sum(h)::int as h,
  sum(doubles)::int as doubles,
  sum(triples)::int as triples,
  sum(hr)::int as hr,
  sum(rbi)::int as rbi,
  sum(bb)::int as bb,
  sum(k)::int as k,
  -- Career rates only when every contributing season knows its at-bats.
  case when bool_and(ab is not null) then sum(ab)::int end as ab,
  case when bool_and(ab is not null) and sum(ab) > 0
       then round(sum(h)::numeric / sum(ab), 4) end as batting_average
from public.player_season_stats
group by player_id;
