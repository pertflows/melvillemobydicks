-- 0006_rls_and_storage
-- Row level security and storage buckets.
--
-- Model: the public site is fully readable by anonymous visitors. Every write
-- is gated in the DATABASE, not in React. An unauthenticated client holding the
-- publishable key cannot insert, update or delete anything, regardless of what
-- the UI does or does not render.
--
--   admin       -> full write on everything
--   scorekeeper -> may record live game data only (PAs, runners, events,
--                  innings, and the live cursor on games)
--   anon/viewer -> read only, and only published content

-- ------------------------------------------------------------- privileges --

grant usage on schema public to anon, authenticated;
grant select on all tables in schema public to anon, authenticated;
alter default privileges in schema public
  grant select on tables to anon, authenticated;

-- ------------------------------------------------------------ enable RLS --

alter table public.profiles              enable row level security;
alter table public.audit_logs            enable row level security;
alter table public.seasons               enable row level security;
alter table public.positions             enable row level security;
alter table public.players               enable row level security;
alter table public.player_seasons        enable row level security;
alter table public.opponents             enable row level security;
alter table public.venues                enable row level security;
alter table public.pa_result_types       enable row level security;
alter table public.games                 enable row level security;
alter table public.game_innings          enable row level security;
alter table public.game_lineups          enable row level security;
alter table public.game_lineup_players   enable row level security;
alter table public.plate_appearances     enable row level security;
alter table public.base_runner_movements enable row level security;
alter table public.game_events           enable row level security;
alter table public.media                 enable row level security;
alter table public.award_types           enable row level security;
alter table public.player_awards         enable row level security;
alter table public.captains_log_posts    enable row level security;
alter table public.sponsors              enable row level security;
alter table public.legacy_stat_baselines enable row level security;

-- --------------------------------------------------------- read policies --

create policy "public read" on public.seasons               for select using (true);
create policy "public read" on public.positions             for select using (true);
create policy "public read" on public.players               for select using (true);
create policy "public read" on public.player_seasons        for select using (true);
create policy "public read" on public.opponents             for select using (true);
create policy "public read" on public.venues                for select using (true);
create policy "public read" on public.pa_result_types       for select using (true);
create policy "public read" on public.games                 for select using (true);
create policy "public read" on public.game_innings          for select using (true);
create policy "public read" on public.game_lineups          for select using (true);
create policy "public read" on public.game_lineup_players   for select using (true);
create policy "public read" on public.plate_appearances     for select using (true);
create policy "public read" on public.base_runner_movements for select using (true);
create policy "public read" on public.game_events           for select using (true);
create policy "public read" on public.media                 for select using (true);
create policy "public read" on public.award_types           for select using (true);
create policy "public read" on public.player_awards         for select using (true);
create policy "public read" on public.sponsors              for select using (true);
create policy "public read" on public.legacy_stat_baselines for select using (true);

-- Drafts stay private until published.
create policy "public read published" on public.captains_log_posts
  for select using (is_published or public.is_admin());

-- Profiles: your own row, or any row if you are an admin.
create policy "read own profile" on public.profiles
  for select using (id = auth.uid() or public.is_admin());

-- Note: there is deliberately no self-service UPDATE policy on profiles.
-- Any such policy needs to read profiles to check the role is unchanged, which
-- recurses under RLS. Role changes go through an admin.

create policy "admin manage profiles" on public.profiles
  for all using (public.is_admin()) with check (public.is_admin());

-- Audit log is admin-only and append-only from the app's point of view.
create policy "admin read audit" on public.audit_logs
  for select using (public.is_admin());

-- -------------------------------------------------------- admin policies --
-- Full write access for admins across every content table.

do $$
declare t text;
begin
  foreach t in array array[
    'seasons','players','player_seasons','opponents','venues','games',
    'game_innings','game_lineups','game_lineup_players','plate_appearances',
    'base_runner_movements','game_events','media','player_awards',
    'captains_log_posts','sponsors','legacy_stat_baselines','positions',
    'pa_result_types','award_types'
  ]
  loop
    execute format(
      'create policy "admin write" on public.%I for all to authenticated
         using (public.is_admin()) with check (public.is_admin())', t);
  end loop;
end $$;

-- --------------------------------------------------- scorekeeper policies --
-- Scorekeepers may record a live game but may not touch roster, schedule or
-- editorial content.

do $$
declare t text;
begin
  foreach t in array array[
    'plate_appearances','base_runner_movements','game_events',
    'game_innings','game_lineups','game_lineup_players'
  ]
  loop
    execute format(
      'create policy "scorekeeper write" on public.%I for all to authenticated
         using (public.can_score()) with check (public.can_score())', t);
  end loop;
end $$;

-- Scorekeepers can advance a game's live state but cannot create or delete games.
create policy "scorekeeper update game" on public.games
  for update to authenticated
  using (public.can_score()) with check (public.can_score());

-- ---------------------------------------------------------------- audit --

do $$
declare t text;
begin
  foreach t in array array[
    'players','player_seasons','games','captains_log_posts','player_awards',
    'legacy_stat_baselines','seasons','sponsors'
  ]
  loop
    execute format(
      'create trigger %I_audit after insert or update or delete on public.%I
         for each row execute function public.audit_row()', t, t);
  end loop;
end $$;

-- --------------------------------------------------------------- storage --

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('players',  'players',  true,  15728640, array['image/webp','image/jpeg','image/png','image/avif']),
  ('media',    'media',    true,  52428800, array['image/webp','image/jpeg','image/png','image/avif','video/mp4','video/quicktime']),
  ('branding', 'branding', true,  10485760, array['image/webp','image/jpeg','image/png','image/svg+xml','image/x-icon']),
  ('originals','originals',false, 104857600, null)
on conflict (id) do nothing;

-- Public buckets are world-readable; only admins may write. The originals
-- bucket holds untouched source files (including HEIC) and is never public.
create policy "public read public buckets" on storage.objects
  for select using (bucket_id in ('players','media','branding'));

create policy "admin read originals" on storage.objects
  for select to authenticated
  using (bucket_id = 'originals' and public.is_admin());

create policy "admin write storage" on storage.objects
  for insert to authenticated
  with check (bucket_id in ('players','media','branding','originals') and public.is_admin());

create policy "admin update storage" on storage.objects
  for update to authenticated
  using (bucket_id in ('players','media','branding','originals') and public.is_admin());

create policy "admin delete storage" on storage.objects
  for delete to authenticated
  using (bucket_id in ('players','media','branding','originals') and public.is_admin());
