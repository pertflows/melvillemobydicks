-- 0009_editable_inning_runs
--
-- A scorekeeper at the field has to be able to make the board right, but our
-- runs are DERIVED from the play log - that is the whole point of the model.
-- Letting someone type over the total would silently divorce the scoreboard
-- from the plays behind it.
--
-- So the linescore becomes the editing surface, per inning and per team:
--
--   game_innings.our_runs   NULL  -> derive this inning from the plays
--                           value -> a deliberate manual override
--   game_innings.their_runs        -> always entered; the opponent's batters
--                                     are not scored individually
--
-- That keeps derivation as the default and makes any override explicit,
-- visible in the linescore, and reversible by clearing it back to NULL.

alter table public.game_innings
  alter column our_runs drop not null,
  alter column our_runs drop default;

-- Existing rows were 0-by-default rather than a deliberate override, and a
-- stray 0 would now suppress real derived runs. Only the legacy import wrote
-- these, and it never set our_runs, so clearing them is safe.
update public.game_innings set our_runs = null where our_runs = 0;

comment on column public.game_innings.our_runs is
  'NULL means derive this inning from the play log. A value is a manual override.';

-- ------------------------------------------------------- per-inning runs --

create view public.game_inning_runs
with (security_invoker = on) as
with derived as (
  select
    pa.game_id,
    pa.inning,
    count(*) filter (where m.scored)::int as derived_our_runs
  from public.plate_appearances pa
  left join public.base_runner_movements m on m.plate_appearance_id = pa.id
  where pa.batting_team = 'us'
  group by pa.game_id, pa.inning
),
keys as (
  select game_id, inning from derived
  union
  select game_id, inning from public.game_innings
)
select
  k.game_id,
  k.inning,
  coalesce(d.derived_our_runs, 0)                         as derived_our_runs,
  gi.our_runs                                             as our_runs_override,
  coalesce(gi.our_runs, d.derived_our_runs, 0)::int       as our_runs,
  coalesce(gi.their_runs, 0)::int                         as their_runs
from keys k
left join derived d
  on d.game_id = k.game_id and d.inning = k.inning
left join public.game_innings gi
  on gi.game_id = k.game_id and gi.inning = k.inning;

-- ------------------------------------------------------------ scoreboard --
-- Totals now come from the linescore, which already resolves override vs
-- derived per inning. Games with neither (everything imported from the old
-- site) still fall back to their recorded final score.

create or replace view public.game_scoreboard
with (security_invoker = on) as
with inning_totals as (
  select game_id, sum(our_runs)::int as our_runs, sum(their_runs)::int as their_runs
  from public.game_inning_runs
  group by game_id
),
scored_games as (
  select distinct game_id from public.plate_appearances
)
select
  g.id as game_id,
  g.season_id,
  coalesce(it.our_runs,   g.our_runs_recorded)::int   as our_runs,
  coalesce(it.their_runs, g.their_runs_recorded)::int as their_runs,
  (sg.game_id is not null) as has_event_data
from public.games g
left join scored_games sg on sg.game_id = g.id
left join inning_totals it on it.game_id = g.id;
