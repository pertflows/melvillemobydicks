-- Protecting an imported final score from a half-finished re-score.
--
-- Games migrated from the old site carry their result in our_runs_recorded and
-- have no play log at all. The scoreboard fell back to those numbers whenever
-- the per-inning totals came out null - which held only while a game had no
-- plays whatsoever, because one recorded appearance is enough to give
-- game_inning_runs a row.
--
-- That was unreachable while finished games could not be scored. Now that they
-- can be reopened and corrected, a single play typed into a 2019 game would
-- have quietly replaced a real 13-6 with 1-0 on the public schedule.
--
-- So the takeover is explicit rather than incidental: a recorded final score
-- stands until somebody enters that game's linescore, inning by inning, on the
-- scorebook. Recording plays builds the statistics; entering the linescore is
-- what says "this game's score comes from here now".

create or replace view public.game_scoreboard
with (security_invoker = on) as
with inning_totals as (
  select game_id, sum(our_runs)::int as our_runs, sum(their_runs)::int as their_runs
  from public.game_inning_runs
  group by game_id
),
scored_games as (
  select distinct game_id from public.plate_appearances
),
-- A linescore of the game's own: rows somebody entered, not rows implied by a
-- play. This is what hands the score over from the recorded result.
has_linescore as (
  select distinct game_id from public.game_innings
)
select
  g.id as game_id,
  g.season_id,
  case
    when g.our_runs_recorded is not null and hl.game_id is null then g.our_runs_recorded
    else coalesce(it.our_runs, g.our_runs_recorded)
  end::int as our_runs,
  case
    when g.their_runs_recorded is not null and hl.game_id is null then g.their_runs_recorded
    else coalesce(it.their_runs, g.their_runs_recorded)
  end::int as their_runs,
  (sg.game_id is not null) as has_event_data
from public.games g
left join scored_games sg on sg.game_id = g.id
left join inning_totals it on it.game_id = g.id
left join has_linescore hl on hl.game_id = g.id;
