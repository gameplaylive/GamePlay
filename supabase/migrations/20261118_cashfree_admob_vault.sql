-- Cashfree payments + AdMob vault fields (replace Stripe for India)

alter table public.app_settings
  add column if not exists cashfree_app_id text not null default '',
  add column if not exists cashfree_secret_key text not null default '',
  add column if not exists cashfree_env text not null default 'sandbox',
  add column if not exists admob_enabled boolean not null default true,
  add column if not exists admob_app_id text not null default '',
  add column if not exists admob_banner_unit_id text not null default '';

do $$ begin
  alter table public.app_settings drop constraint if exists app_settings_cashfree_env_check;
exception when undefined_object then null;
end $$;

alter table public.app_settings
  add constraint app_settings_cashfree_env_check
  check (cashfree_env in ('sandbox', 'production'));

update public.app_settings
set pro_price_usd = 99
where id = 1 and pro_price_usd <= 5;

drop view if exists public.app_settings_public;

create view public.app_settings_public
with (security_invoker = false)
as
select
  id,
  pro_price_usd,
  pro_plan_name,
  pro_plan_description,
  adsense_enabled,
  adsense_publisher_id,
  adsense_slot_id,
  admob_enabled,
  admob_app_id,
  admob_banner_unit_id,
  last_sync_time
from public.app_settings;

grant select on public.app_settings_public to anon, authenticated;

revoke all on public.app_settings from anon;
grant select (
  id, pro_price_usd, pro_plan_name, pro_plan_description,
  adsense_enabled, adsense_publisher_id, adsense_slot_id,
  admob_enabled, admob_app_id, admob_banner_unit_id,
  last_sync_time
) on public.app_settings to authenticated;
