-- 0008_lock_down_auth_helpers
--
-- is_admin()/can_score() must stay EXECUTE-able by `authenticated`, because RLS
-- policy expressions run as the querying role and those policies call them.
-- They should NOT be reachable by anonymous visitors via /rest/v1/rpc.
--
-- Revoking from `anon` alone does nothing: EXECUTE is granted to PUBLIC by
-- default and anon inherits it. Revoke from PUBLIC, then grant back narrowly.
--
-- The one policy an anonymous request could route through is_admin() is the
-- captain's log draft check, so it is split by role: anon sees published posts
-- and never evaluates the function at all.

revoke all on function public.is_admin()  from public, anon, authenticated;
revoke all on function public.can_score() from public, anon, authenticated;

grant execute on function public.is_admin()  to authenticated;
grant execute on function public.can_score() to authenticated;

drop policy "public read published" on public.captains_log_posts;

create policy "anon reads published posts" on public.captains_log_posts
  for select to anon
  using (is_published);

create policy "authenticated reads posts" on public.captains_log_posts
  for select to authenticated
  using (is_published or public.is_admin());
