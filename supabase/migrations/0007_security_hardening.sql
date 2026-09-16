-- 0007_security_hardening
-- Resolves the findings from the Supabase security linter.
--
-- 1. Pin search_path on every function so a caller cannot shadow the objects a
--    SECURITY DEFINER function resolves.
-- 2. Trigger functions are not API surface: revoke EXECUTE so they are not
--    callable through /rest/v1/rpc.
-- 3. Drop the citext extension out of the public schema. auth.users already
--    normalises email, so profiles.email is plain text.

-- ------------------------------------------------- pin function search_path --

alter function public.set_updated_at()            set search_path = public, pg_temp;
alter function public.unaccent_fallback(text)     set search_path = public, pg_temp;
alter function public.slugify(text)               set search_path = public, pg_temp;

-- ------------------------------------------- trigger functions are not RPC --

revoke all on function public.audit_row()        from anon, authenticated, public;
revoke all on function public.handle_new_user()  from anon, authenticated, public;
revoke all on function public.set_updated_at()   from anon, authenticated, public;

-- is_admin()/can_score() answer "what am I allowed to do", which is safe for a
-- signed-in user to ask about themselves, but pointless for anonymous callers.
revoke all on function public.is_admin()  from anon;
revoke all on function public.can_score() from anon;

-- ------------------------------------------------------------ drop citext --

alter table public.profiles alter column email type text;
drop extension if exists citext;
