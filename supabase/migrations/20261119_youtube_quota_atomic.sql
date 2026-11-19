-- Atomic daily YouTube quota bumps (avoids lost updates under concurrent crons).
create or replace function public.youtube_quota_add(
  p_day date,
  p_search integer,
  p_units integer
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.youtube_quota_daily as q (day, search_list_calls, units_estimated, updated_at)
  values (
    p_day,
    greatest(coalesce(p_search, 0), 0),
    greatest(coalesce(p_units, 0), 0),
    now()
  )
  on conflict (day) do update set
    search_list_calls = q.search_list_calls + excluded.search_list_calls,
    units_estimated = q.units_estimated + excluded.units_estimated,
    updated_at = now();
end;
$$;

revoke all on function public.youtube_quota_add(date, integer, integer) from public;
grant execute on function public.youtube_quota_add(date, integer, integer) to service_role;
