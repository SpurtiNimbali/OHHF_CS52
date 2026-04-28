-- Exposes the 3 security question ids for a username (no answer material).
-- Required for the sign-in screen after username. Grant execute to anon + authenticated.
-- Postgres will not "replace" a function if its return row shape changes; drop first.
drop function if exists public.get_user_sign_in_preview(text);

create or replace function public.get_user_sign_in_preview(p_username text)
  returns table (
    user_id uuid,
    security_q1_id int,
    security_q2_id int,
    security_q3_id int
  )
  language sql
  security definer
  set search_path = public
  stable
as $$
  select
    u.id,
    u.security_q1_id,
    u.security_q2_id,
    u.security_q3_id
  from public.users u
  where lower(btrim(u.username::text)) = lower(btrim(p_username))
  limit 1;
$$;

grant execute on function public.get_user_sign_in_preview(text) to anon;
grant execute on function public.get_user_sign_in_preview(text) to authenticated;
