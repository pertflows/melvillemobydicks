-- Correcting a finished game against the paper scorebook.
--
-- The play log stays the source of truth, and everything still derives from it.
-- This is for the gap between the two: the game was scored on a phone at the
-- field, the paper book was kept properly, and the paper book is right.
--
-- Rather than invent plate appearances to make the numbers add up - which would
-- put fictional at-bats in the log and lie about how a run scored - a corrected
-- line is stored alongside the derived one, per player per game. Every column is
-- nullable, and null means "use the plays". Correcting only the RBI leaves
-- everything else deriving as before.

create table public.game_stat_overrides (
  game_id    uuid not null references public.games(id)   on delete cascade,
  player_id  uuid not null references public.players(id) on delete cascade,

  -- What the paper book says. Null = whatever the plays say.
  ab         smallint check (ab      >= 0),
  h          smallint check (h       >= 0),
  doubles    smallint check (doubles >= 0),
  triples    smallint check (triples >= 0),
  hr         smallint check (hr      >= 0),
  r          smallint check (r       >= 0),
  rbi        smallint check (rbi     >= 0),
  bb         smallint check (bb      >= 0),
  k          smallint check (k       >= 0),

  note       text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  primary key (game_id, player_id),

  -- A hit is an at-bat, and the extra-base hits are a subset of the hits.
  constraint gso_hits_within_at_bats check (h is null or ab is null or h <= ab),
  constraint gso_extra_bases_within_hits check (
    h is null or coalesce(doubles, 0) + coalesce(triples, 0) + coalesce(hr, 0) <= h
  ),
  constraint gso_strikeouts_within_at_bats check (k is null or ab is null or k <= ab),

  -- A row where everything is null corrects nothing; clearing the last value
  -- deletes the row instead.
  constraint gso_not_empty check (
    num_nonnulls(ab, h, doubles, triples, hr, r, rbi, bb, k) > 0
  )
);

create trigger game_stat_overrides_set_updated_at before update on public.game_stat_overrides
  for each row execute function public.set_updated_at();

create trigger game_stat_overrides_audit
  after insert or update or delete on public.game_stat_overrides
  for each row execute function public.audit_row();

comment on table public.game_stat_overrides is
  'Hand-corrected batting lines per player per game. Null column = derive from the play log.';

alter table public.game_stat_overrides enable row level security;

create policy "public read" on public.game_stat_overrides
  for select using (true);

create policy "scorers write" on public.game_stat_overrides
  for all using (public.can_score()) with check (public.can_score());

-- --------------------------------------------------------- derived split --
--
-- What the plays alone say. This is the body player_game_stats had before
-- corrections existed, lifted into its own view so that the correction screen
-- can show both numbers side by side: what was counted, and what was entered.

create view public.player_game_stats_derived
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

comment on view public.player_game_stats_derived is
  'Per-game batting straight from the play log, before any hand correction.';

-- ------------------------------------------------- resolved game batting --
--
-- Replaced in place, with the same columns in the same order, so that
-- player_season_stats and player_career_stats - which both sum this view - pick
-- corrections up without a change of their own.

create or replace view public.player_game_stats
with (security_invoker = on) as
with keys as (
  select game_id, season_id, player_id from public.player_game_stats_derived
  union
  -- A corrected line may belong to somebody with no recorded play at all.
  select o.game_id, g.season_id, o.player_id
  from public.game_stat_overrides o
  join public.games g on g.id = o.game_id
),
resolved as (
  select
    k.game_id, k.season_id, k.player_id,
    coalesce(d.pa, 0) as derived_pa,
    coalesce(d.ab, 0) as derived_ab,
    coalesce(d.bb, 0) as derived_bb,
    coalesce(o.ab,      d.ab,      0)::int as ab,
    coalesce(o.h,       d.h,       0)::int as h,
    coalesce(o.doubles, d.doubles, 0)::int as doubles,
    coalesce(o.triples, d.triples, 0)::int as triples,
    coalesce(o.hr,      d.hr,      0)::int as hr,
    coalesce(o.r,       d.r,       0)::int as r,
    coalesce(o.rbi,     d.rbi,     0)::int as rbi,
    coalesce(o.bb,      d.bb,      0)::int as bb,
    coalesce(o.k,       d.k,       0)::int as k,
    coalesce(d.hbp, 0) as hbp,
    coalesce(d.sf,  0) as sf,
    coalesce(d.sac, 0) as sac,
    coalesce(d.roe, 0) as roe,
    coalesce(d.fc,  0) as fc,
    (o.game_id is not null) as corrected
  from keys k
  left join public.player_game_stats_derived d
         on d.game_id = k.game_id and d.player_id = k.player_id
  left join public.game_stat_overrides o
         on o.game_id = k.game_id and o.player_id = k.player_id
)
select
  game_id,
  season_id,
  player_id,
  -- Correcting at-bats or walks moves plate appearances by the same amount,
  -- while leaving anything else the log caught - a hit by pitch, a sacrifice -
  -- where it is.
  case
    when corrected
      then greatest(derived_pa + (ab - derived_ab) + (bb - derived_bb), 0)
    else derived_pa
  end::int as pa,
  ab,
  r,
  h,
  -- Singles and total bases follow from the rest, so a corrected line stays
  -- internally consistent instead of contradicting itself.
  greatest(h - doubles - triples - hr, 0)::int as singles,
  doubles,
  triples,
  hr,
  (greatest(h - doubles - triples - hr, 0) + 2 * doubles + 3 * triples + 4 * hr)::int as tb,
  rbi,
  bb,
  hbp,
  k,
  sf,
  sac,
  roe,
  fc
from resolved;
