-- 0001_foundations
-- Extensions, shared helpers, identity and audit.

create extension if not exists "pgcrypto";
create extension if not exists "citext";

-- ---------------------------------------------------------------- helpers --

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- unaccent may not be available on all instances; degrade gracefully.
create or replace function public.unaccent_fallback(value text)
returns text
language sql
immutable
strict
as $$
  select translate(
    value,
    'àáâãäåaaaèéêëeeeìíîïiiiòóôõöoooùúûüuuuçñýÿÀÁÂÃÄÅAAAÈÉÊËEEEÌÍÎÏIIIÒÓÔÕÖOOOÙÚÛÜUUUÇÑÝ',
    'aaaaaaaaaeeeeeeeiiiiiiiooooooooouuuuuuucnyyAAAAAAAAAEEEEEEEIIIIIIIOOOOOOOOOUUUUUUUCNY'
  );
$$;

-- Slugify: "Nicholas Caracappa" -> "nicholas-caracappa"
create or replace function public.slugify(value text)
returns text
language sql
immutable
strict
as $$
  select trim(both '-' from
    regexp_replace(
      regexp_replace(lower(public.unaccent_fallback(value)), '[^a-z0-9]+', '-', 'g'),
      '-{2,}', '-', 'g'
    )
  );
$$;

-- --------------------------------------------------------------- identity --

create type public.app_role as enum ('admin', 'scorekeeper', 'viewer');

-- One row per auth user. Mirrors auth.users and carries authorization role.
create table public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  email       citext,
  full_name   text,
  role        public.app_role not null default 'viewer',
  player_id   uuid,                 -- optional link to a roster player (FK added in 0002)
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- Authorization predicates. SECURITY DEFINER so RLS on profiles cannot recurse.
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  );
$$;

-- Scorekeepers can record game events; admins can do everything.
create or replace function public.can_score()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role in ('admin', 'scorekeeper')
  );
$$;

-- New auth users get a profile automatically, defaulting to the lowest role.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1))
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ------------------------------------------------------------------ audit --

create table public.audit_logs (
  id          bigserial primary key,
  actor_id    uuid references auth.users(id) on delete set null,
  action      text not null,              -- 'insert' | 'update' | 'delete' | domain verb
  entity      text not null,              -- table or domain object name
  entity_id   text,
  summary     text,                       -- human-readable, shown in admin activity feed
  diff        jsonb,
  created_at  timestamptz not null default now()
);

create index audit_logs_created_at_idx on public.audit_logs (created_at desc);
create index audit_logs_entity_idx     on public.audit_logs (entity, entity_id);

-- Generic audit trigger. Attached selectively to mutable domain tables.
create or replace function public.audit_row()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  rec_id text;
begin
  rec_id := (to_jsonb(case when tg_op = 'DELETE' then old else new end) ->> 'id');

  insert into public.audit_logs (actor_id, action, entity, entity_id, diff)
  values (
    auth.uid(),
    lower(tg_op),
    tg_table_name,
    rec_id,
    case
      when tg_op = 'INSERT' then jsonb_build_object('new', to_jsonb(new))
      when tg_op = 'DELETE' then jsonb_build_object('old', to_jsonb(old))
      else jsonb_build_object('old', to_jsonb(old), 'new', to_jsonb(new))
    end
  );

  return case when tg_op = 'DELETE' then old else new end;
end;
$$;
