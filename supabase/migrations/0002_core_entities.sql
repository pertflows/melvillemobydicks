-- 0002_core_entities
-- Seasons, reference data, players and season-scoped roster membership.

-- ---------------------------------------------------------------- seasons --

-- A season is a year plus an optional session label, so a single calendar year
-- can hold multiple league sessions ("2027 Spring", "2027 Fall") without any
-- part of the app hardcoding a year.
create table public.seasons (
  id           uuid primary key default gen_random_uuid(),
  year         smallint not null,
  label        text,                        -- 'Spring', 'Fall', null for a single-session year
  name         text not null,               -- display: '2026' or '2027 Fall'
  slug         text not null unique,
  league_name  text,
  starts_on    date,
  ends_on      date,
  is_current   boolean not null default false,
  sort_order   smallint not null default 0,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (year, label)
);

create trigger seasons_set_updated_at
  before update on public.seasons
  for each row execute function public.set_updated_at();

-- Exactly one season may be flagged current.
create unique index seasons_single_current_idx
  on public.seasons ((is_current)) where is_current;

-- -------------------------------------------------------------- positions --

-- Reference table rather than an enum: labels are display copy and the set
-- grows (rover, EH, relief pitcher) without a type migration.
create table public.positions (
  code         text primary key,
  label        text not null,
  short_label  text not null,
  category     text not null check (category in ('pitcher','catcher','infield','outfield','utility')),
  sort_order   smallint not null default 0
);

insert into public.positions (code, label, short_label, category, sort_order) values
  ('SP',  'Starting Pitcher', 'SP',  'pitcher',  10),
  ('RP',  'Relief Pitcher',   'RP',  'pitcher',  20),
  ('P',   'Pitcher',          'P',   'pitcher',  30),
  ('C',   'Catcher',          'C',   'catcher',  40),
  ('1B',  'First Baseman',    '1B',  'infield',  50),
  ('2B',  'Second Baseman',   '2B',  'infield',  60),
  ('3B',  'Third Baseman',    '3B',  'infield',  70),
  ('SS',  'Shortstop',        'SS',  'infield',  80),
  ('IF',  'Infielder',        'IF',  'infield',  90),
  ('LF',  'Left Fielder',     'LF',  'outfield', 100),
  ('CF',  'Center Fielder',   'CF',  'outfield', 110),
  ('RF',  'Right Fielder',    'RF',  'outfield', 120),
  ('OF',  'Outfielder',       'OF',  'outfield', 130),
  ('ROV', 'Rover',            'ROV', 'outfield', 140),
  ('EH',  'Extra Hitter',     'EH',  'utility',  150),
  ('DH',  'Designated Hitter','DH',  'utility',  160);

-- ---------------------------------------------------------------- players --

-- A player is a person, and persists forever. Leaving the team changes status;
-- it never deletes the row, so historical stats and awards stay intact.
create type public.player_status as enum ('active', 'inactive', 'alumni');

create table public.players (
  id                    uuid primary key default gen_random_uuid(),
  first_name            text not null,
  last_name             text not null,
  display_name          text not null,
  slug                  text not null unique,
  bio                   text,
  status                public.player_status not null default 'active',
  primary_position      text references public.positions(code),
  secondary_positions   text[] not null default '{}',
  bats                  text check (bats in ('R','L','S')),
  throws                text check (throws in ('R','L')),
  photo_path            text,        -- optimized, browser-servable (WebP/JPEG) in Storage
  photo_original_path   text,        -- untouched original (may be HEIC) kept for archive
  photo_width           int,
  photo_height          int,
  photo_placeholder     text,        -- tiny base64 LQIP for blur-up
  hometown              text,
  joined_year           smallint,
  legacy_id             text unique, -- id on the old site, makes the import idempotent
  legacy_position_label text,        -- original label verbatim, for fidelity checks
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create trigger players_set_updated_at
  before update on public.players
  for each row execute function public.set_updated_at();

create index players_status_idx on public.players (status);

alter table public.profiles
  add constraint profiles_player_id_fkey
  foreign key (player_id) references public.players(id) on delete set null;

-- --------------------------------------------------------- season rosters --

-- Season-scoped membership. Jersey number, position and status live HERE, not on
-- players, so a player can change number between seasons without rewriting history.
-- (This is the single "roster_membership" concept; there is no separate table.)
create table public.player_seasons (
  id                   uuid primary key default gen_random_uuid(),
  player_id            uuid not null references public.players(id) on delete cascade,
  season_id            uuid not null references public.seasons(id) on delete cascade,
  jersey_number        smallint,
  primary_position     text references public.positions(code),
  secondary_positions  text[] not null default '{}',
  status               public.player_status not null default 'active',
  roster_order         smallint,
  joined_on            date,
  left_on              date,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  unique (player_id, season_id)
);

create trigger player_seasons_set_updated_at
  before update on public.player_seasons
  for each row execute function public.set_updated_at();

-- Two players cannot share a number within one season.
create unique index player_seasons_jersey_unique_idx
  on public.player_seasons (season_id, jersey_number)
  where jersey_number is not null;

create index player_seasons_season_idx on public.player_seasons (season_id);

-- -------------------------------------------------------------- opponents --

create table public.opponents (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  short_name    text,
  slug          text not null unique,
  logo_path     text,
  primary_color text,
  notes         text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create trigger opponents_set_updated_at
  before update on public.opponents
  for each row execute function public.set_updated_at();

-- ----------------------------------------------------------------- venues --

-- Split park from field so "Cantiague Park - Field C" and "- Field D" group
-- under one park for maps and directions.
create table public.venues (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,              -- 'Cantiague Park'
  field        text,                       -- 'Field D'
  display_name text generated always as (
                 case when field is null or field = '' then name
                      else name || ' - ' || field end
               ) stored,
  slug         text not null unique,
  address      text,
  city         text,
  state        text,
  postal_code  text,
  latitude     numeric(9,6),
  longitude    numeric(9,6),
  map_url      text,
  notes        text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (name, field)
);

create trigger venues_set_updated_at
  before update on public.venues
  for each row execute function public.set_updated_at();
