-- 0003_games_and_scoring
-- Games, lineups, and the event-level scoring model.
--
-- SOURCE OF TRUTH: for any game scored through the app, plate_appearances and
-- base_runner_movements ARE the statistics. Nothing here stores a batting
-- average or a hit total. Correcting a play corrects every downstream number
-- because every number is a view over these rows (see 0005_stat_views.sql).

-- ------------------------------------------------------- result taxonomy --

-- Stat classification lives in DATA, not in a CASE expression buried in a view.
-- Adding SB/CS/PB later is an INSERT here plus a column in one view, never a
-- rewrite of the stat engine.
create table public.pa_result_types (
  code               text primary key,
  label              text not null,
  short_label        text not null,
  counts_as_pa       boolean not null default true,
  counts_as_ab       boolean not null default true,
  is_hit             boolean not null default false,
  total_bases        smallint not null default 0,
  is_walk            boolean not null default false,
  is_hbp             boolean not null default false,
  is_strikeout       boolean not null default false,
  is_sac_fly         boolean not null default false,
  is_sac_bunt        boolean not null default false,
  is_error           boolean not null default false,
  is_fielders_choice boolean not null default false,
  batter_reaches     boolean not null default false,
  default_outs       smallint not null default 0,
  is_active          boolean not null default true,
  sort_order         smallint not null default 0
);

insert into public.pa_result_types
  (code, label, short_label, counts_as_pa, counts_as_ab, is_hit, total_bases,
   is_walk, is_hbp, is_strikeout, is_sac_fly, is_sac_bunt, is_error,
   is_fielders_choice, batter_reaches, default_outs, sort_order) values
  ('1B',  'Single',                '1B',  true,  true,  true,  1, false,false,false,false,false,false,false,true,  0, 10),
  ('2B',  'Double',                '2B',  true,  true,  true,  2, false,false,false,false,false,false,false,true,  0, 20),
  ('3B',  'Triple',                '3B',  true,  true,  true,  3, false,false,false,false,false,false,false,true,  0, 30),
  ('HR',  'Home Run',              'HR',  true,  true,  true,  4, false,false,false,false,false,false,false,true,  0, 40),
  ('BB',  'Walk',                  'BB',  true,  false, false, 0, true, false,false,false,false,false,false,true,  0, 50),
  ('IBB', 'Intentional Walk',      'IBB', true,  false, false, 0, true, false,false,false,false,false,false,true,  0, 60),
  ('HBP', 'Hit By Pitch',          'HBP', true,  false, false, 0, false,true, false,false,false,false,false,true,  0, 70),
  ('ROE', 'Reached On Error',      'ROE', true,  true,  false, 0, false,false,false,false,false,true, false,true,  0, 80),
  ('FC',  'Fielder''s Choice',     'FC',  true,  true,  false, 0, false,false,false,false,false,false,true, true,  0, 90),
  ('CI',  'Catcher Interference',  'CI',  true,  false, false, 0, false,false,false,false,false,false,false,true,  0, 95),
  ('K',   'Strikeout',             'K',   true,  true,  false, 0, false,false,true, false,false,false,false,false, 1, 100),
  ('GO',  'Ground Out',            'GO',  true,  true,  false, 0, false,false,false,false,false,false,false,false, 1, 110),
  ('FO',  'Fly Out',               'FO',  true,  true,  false, 0, false,false,false,false,false,false,false,false, 1, 120),
  ('LO',  'Line Out',              'LO',  true,  true,  false, 0, false,false,false,false,false,false,false,false, 1, 130),
  ('PO',  'Pop Out',               'PO',  true,  true,  false, 0, false,false,false,false,false,false,false,false, 1, 140),
  ('OUT', 'Out',                   'OUT', true,  true,  false, 0, false,false,false,false,false,false,false,false, 1, 150),
  ('SF',  'Sacrifice Fly',         'SF',  true,  false, false, 0, false,false,false,true, false,false,false,false, 1, 160),
  ('SAC', 'Sacrifice Bunt',        'SAC', true,  false, false, 0, false,false,false,false,true, false,false,false, 1, 170),
  ('DP',  'Double Play',           'DP',  true,  true,  false, 0, false,false,false,false,false,false,false,false, 2, 180),
  ('TP',  'Triple Play',           'TP',  true,  true,  false, 0, false,false,false,false,false,false,false,false, 3, 190);

-- ------------------------------------------------------------------ games --

create type public.game_status  as enum ('scheduled','pregame','live','final','cancelled','postponed');
create type public.home_away    as enum ('home','away');
create type public.inning_half  as enum ('top','bottom');

create table public.games (
  id                  uuid primary key default gen_random_uuid(),
  season_id           uuid not null references public.seasons(id) on delete restrict,
  opponent_id         uuid references public.opponents(id) on delete set null,
  venue_id            uuid references public.venues(id) on delete set null,
  starts_at           timestamptz not null,
  status              public.game_status not null default 'scheduled',
  home_away           public.home_away not null default 'home',

  -- Doubleheaders: games come in pairs. game_number is 1 or 2 within a series.
  series_key          text,
  game_number         smallint not null default 1 check (game_number between 1 and 4),

  scheduled_innings   smallint not null default 7,

  -- Recorded final score. Authoritative ONLY for games with no event data
  -- (i.e. everything migrated from the legacy site). For scored games the
  -- scoreboard view derives runs from events and ignores these.
  our_runs_recorded   smallint,
  their_runs_recorded smallint,

  -- Live cursor. Operational state, NOT a statistic.
  current_inning      smallint,
  current_half        public.inning_half,
  current_outs        smallint check (current_outs between 0 and 3),
  live_started_at     timestamptz,
  finalized_at        timestamptz,

  is_mercy            boolean not null default false,
  is_forfeit          boolean not null default false,
  recap               text,
  notes               text,
  legacy_id           text unique,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create trigger games_set_updated_at before update on public.games
  for each row execute function public.set_updated_at();

create index games_season_starts_idx on public.games (season_id, starts_at);
create index games_status_idx        on public.games (status);
create index games_starts_at_idx     on public.games (starts_at);

-- Linescore. Opponent runs are entered by the scorekeeper; our runs are
-- derived from runner movements for scored games and only read from here
-- for games imported without event detail.
create table public.game_innings (
  id         uuid primary key default gen_random_uuid(),
  game_id    uuid not null references public.games(id) on delete cascade,
  inning     smallint not null check (inning > 0),
  our_runs   smallint not null default 0,
  their_runs smallint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (game_id, inning)
);

create trigger game_innings_set_updated_at before update on public.game_innings
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------- lineups --

create table public.game_lineups (
  id                    uuid primary key default gen_random_uuid(),
  game_id               uuid not null references public.games(id) on delete cascade,
  copied_from_lineup_id uuid references public.game_lineups(id) on delete set null,
  notes                 text,
  created_by            uuid references auth.users(id) on delete set null,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  unique (game_id)
);

create trigger game_lineups_set_updated_at before update on public.game_lineups
  for each row execute function public.set_updated_at();

create table public.game_lineup_players (
  id             uuid primary key default gen_random_uuid(),
  lineup_id      uuid not null references public.game_lineups(id) on delete cascade,
  player_id      uuid not null references public.players(id) on delete restrict,
  batting_order  smallint not null check (batting_order > 0),
  position       text references public.positions(code),
  is_starter     boolean not null default true,
  entered_inning smallint,
  exited_inning  smallint,
  created_at     timestamptz not null default now()
);

-- One starter per batting slot; substitutes share the slot they replace.
create unique index game_lineup_starter_slot_idx
  on public.game_lineup_players (lineup_id, batting_order) where is_starter;
create index game_lineup_players_lineup_idx on public.game_lineup_players (lineup_id);

-- ----------------------------------------------------- plate appearances --

create table public.plate_appearances (
  id            uuid primary key default gen_random_uuid(),
  game_id       uuid not null references public.games(id) on delete cascade,
  batting_team  text not null default 'us' check (batting_team in ('us','them')),
  batter_id     uuid references public.players(id) on delete restrict,
  inning        smallint not null check (inning > 0),
  half          public.inning_half not null,
  sequence      integer not null,
  lineup_spot   smallint,
  result_code   text not null references public.pa_result_types(code),
  outs_before   smallint not null default 0 check (outs_before between 0 and 2),
  outs_on_play  smallint not null default 0 check (outs_on_play between 0 and 3),
  hit_location  text,
  is_hard_hit   boolean,
  notes         text,
  created_by    uuid references auth.users(id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (game_id, sequence)
);

create trigger plate_appearances_set_updated_at before update on public.plate_appearances
  for each row execute function public.set_updated_at();

create index pa_game_idx   on public.plate_appearances (game_id, sequence);
create index pa_batter_idx on public.plate_appearances (batter_id);

-- Every runner's movement on a play, including the batter (start_base = 0).
-- Runs, RBI and LOB all derive from these rows.
create table public.base_runner_movements (
  id                  uuid primary key default gen_random_uuid(),
  plate_appearance_id uuid not null references public.plate_appearances(id) on delete cascade,
  runner_id           uuid references public.players(id) on delete restrict,
  start_base          smallint not null check (start_base between 0 and 3),  -- 0 = batter
  end_base            smallint check (end_base between 1 and 4),             -- 4 = home
  is_out              boolean not null default false,
  out_type            text,
  scored              boolean generated always as (end_base = 4 and not is_out) stored,
  rbi_credited        boolean not null default false,
  is_earned           boolean not null default true,
  created_at          timestamptz not null default now()
);

create index brm_pa_idx     on public.base_runner_movements (plate_appearance_id);
create index brm_runner_idx on public.base_runner_movements (runner_id);

-- A runner cannot be credited an RBI unless they actually scored.
alter table public.base_runner_movements
  add constraint brm_rbi_requires_score
  check (not rbi_credited or (end_base = 4 and not is_out));

-- ------------------------------------------------------------ event feed --

-- Append-only narrative log. Powers the live public feed, realtime updates and
-- the "what happened" audit of a game. Statistics never read from here.
create type public.game_event_type as enum (
  'game_start','inning_change','plate_appearance','substitution',
  'opponent_runs','correction','note','status_change','game_final'
);

create table public.game_events (
  id                  bigserial primary key,
  game_id             uuid not null references public.games(id) on delete cascade,
  event_type          public.game_event_type not null,
  inning              smallint,
  half                public.inning_half,
  plate_appearance_id uuid references public.plate_appearances(id) on delete cascade,
  description         text,
  payload             jsonb not null default '{}'::jsonb,
  actor_id            uuid references auth.users(id) on delete set null,
  created_at          timestamptz not null default now()
);

create index game_events_game_idx on public.game_events (game_id, id desc);
