-- 0004_content_and_legacy
-- Media, editorial content, awards, sponsors, and the legacy stat baselines.

-- ------------------------------------------------------------------ media --

create type public.media_kind as enum ('photo','video');

create table public.media (
  id             uuid primary key default gen_random_uuid(),
  kind           public.media_kind not null default 'photo',
  storage_path   text not null,          -- optimized, browser-servable (WebP/JPEG)
  original_path  text,                   -- untouched original, may be HEIC
  original_format text,                  -- 'heic', 'png', 'jpeg' ... as migrated
  width          int,
  height         int,
  placeholder    text,                   -- base64 LQIP
  byte_size      bigint,
  caption        text,
  alt_text       text,
  credit         text,
  game_id        uuid references public.games(id) on delete set null,
  player_id      uuid references public.players(id) on delete set null,
  season_id      uuid references public.seasons(id) on delete set null,
  taken_at       timestamptz,
  sort_order     smallint not null default 0,
  is_featured    boolean not null default false,
  legacy_id      text unique,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create trigger media_set_updated_at before update on public.media
  for each row execute function public.set_updated_at();

create index media_game_idx   on public.media (game_id);
create index media_player_idx on public.media (player_id);

-- ----------------------------------------------------------------- awards --

create table public.award_types (
  code        text primary key,
  label       text not null,
  description text,
  is_per_game boolean not null default true,
  sort_order  smallint not null default 0
);

insert into public.award_types (code, label, description, is_per_game, sort_order) values
  ('potg',      'Player of the Game', 'Awarded after each game.',        true,  10),
  ('mvp',       'Season MVP',         'Awarded at the end of a season.', false, 20),
  ('rookie',    'Rookie of the Year', null,                              false, 30),
  ('gold_glove','Gold Glove',         null,                              false, 40);

create table public.player_awards (
  id          uuid primary key default gen_random_uuid(),
  player_id   uuid not null references public.players(id) on delete cascade,
  award_code  text not null references public.award_types(code),
  game_id     uuid references public.games(id) on delete cascade,
  season_id   uuid references public.seasons(id) on delete set null,
  awarded_on  date,
  citation    text,
  media_id    uuid references public.media(id) on delete set null,
  legacy_id   text unique,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create trigger player_awards_set_updated_at before update on public.player_awards
  for each row execute function public.set_updated_at();

-- One Player of the Game per game.
create unique index player_awards_one_potg_per_game_idx
  on public.player_awards (game_id, award_code)
  where game_id is not null and award_code = 'potg';

create index player_awards_player_idx on public.player_awards (player_id);

-- --------------------------------------------------------- captain's log --

create table public.captains_log_posts (
  id               uuid primary key default gen_random_uuid(),
  title            text not null,
  slug             text not null unique,
  excerpt          text,
  body             text not null,
  author_player_id uuid references public.players(id) on delete set null,
  author_name      text,
  game_id          uuid references public.games(id) on delete set null,
  season_id        uuid references public.seasons(id) on delete set null,
  hero_media_id    uuid references public.media(id) on delete set null,
  published_at     timestamptz,
  is_published     boolean not null default true,
  legacy_id        text unique,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create trigger captains_log_posts_set_updated_at before update on public.captains_log_posts
  for each row execute function public.set_updated_at();

create index captains_log_published_idx
  on public.captains_log_posts (published_at desc) where is_published;

-- --------------------------------------------------------------- sponsors --

create table public.sponsors (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  slug        text not null unique,
  logo_path   text,
  website_url text,
  tier        text check (tier in ('platinum','gold','silver','community')),
  blurb       text,
  sort_order  smallint not null default 0,
  is_active   boolean not null default true,
  legacy_id   text unique,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create trigger sponsors_set_updated_at before update on public.sponsors
  for each row execute function public.set_updated_at();

-- -------------------------------------------------------- legacy baselines --
--
-- The old site published AVG / HR / RBI / H / BB / G and nothing else. It did
-- NOT publish AB or PA, so a true batting average cannot be reconstructed and
-- AB MUST NOT be back-computed from AVG - that would invent plate appearances
-- that never existed in any record we hold.
--
-- This table stores exactly what the old site showed, marks what is unknown as
-- NULL, and keeps the source URL for every row. Season totals combine these
-- baselines with event-derived stats; rate stats declare their basis so the UI
-- can be honest about which numbers are computed and which are inherited.
-- Historical scorebooks can be backfilled later by filling in the NULLs, at
-- which point the derived path takes over automatically.

create table public.legacy_stat_baselines (
  id                       uuid primary key default gen_random_uuid(),
  player_id                uuid not null references public.players(id) on delete cascade,
  season_id                uuid not null references public.seasons(id) on delete cascade,

  -- Published by the legacy site (known).
  games                    smallint,
  hits                     smallint,
  home_runs                smallint,
  walks                    smallint,
  rbi                      smallint,

  -- Not published by the legacy site (unknown unless backfilled from scorebooks).
  at_bats                  smallint,
  plate_appearances        smallint,
  doubles                  smallint,
  triples                  smallint,
  runs                     smallint,
  hit_by_pitch             smallint,
  sacrifice_flies          smallint,
  total_bases              smallint,

  -- The average the old site displayed, preserved verbatim. Used for display
  -- when at_bats is unknown; never used to derive at_bats.
  batting_average_override numeric(5,4),

  notes                    text,
  source_url               text,
  imported_at              timestamptz not null default now(),
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now(),
  unique (player_id, season_id)
);

create trigger legacy_stat_baselines_set_updated_at
  before update on public.legacy_stat_baselines
  for each row execute function public.set_updated_at();

-- Guard rails: counts are non-negative, and hits can never exceed at-bats when
-- at-bats is actually known.
alter table public.legacy_stat_baselines
  add constraint legacy_baseline_non_negative check (
    coalesce(games,0) >= 0 and coalesce(hits,0) >= 0 and coalesce(home_runs,0) >= 0
    and coalesce(walks,0) >= 0 and coalesce(rbi,0) >= 0
    and coalesce(at_bats,0) >= 0 and coalesce(plate_appearances,0) >= 0
  ),
  add constraint legacy_baseline_hits_lte_ab check (
    at_bats is null or hits is null or hits <= at_bats
  );
