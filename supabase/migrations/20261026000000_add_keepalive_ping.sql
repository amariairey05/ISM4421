-- Tiny read-only function a scheduled GitHub Action calls every few days so
-- the free-tier project sees activity and is not auto-paused.
-- Already applied to project aiitajwhzjcjlckgazhq; kept here for reference.
create or replace function public.keepalive()
returns timestamptz
language sql
stable
security invoker
set search_path = ''
as $$ select now() $$;

revoke all on function public.keepalive() from public;
grant execute on function public.keepalive() to anon, authenticated;
