-- Manual / imported AdSense + AdMob earnings for Admin analytics

create table if not exists public.ad_earnings (
  id uuid primary key default gen_random_uuid(),
  network text not null check (network in ('adsense', 'admob')),
  earning_date date not null,
  amount numeric(12, 2) not null default 0,
  currency text not null default 'INR',
  impressions integer not null default 0,
  clicks integer not null default 0,
  notes text not null default '',
  created_at timestamptz not null default now(),
  unique (network, earning_date, currency)
);

create index if not exists ad_earnings_date_idx on public.ad_earnings (earning_date desc);
create index if not exists ad_earnings_network_idx on public.ad_earnings (network, earning_date desc);

alter table public.ad_earnings enable row level security;

drop policy if exists "Admins manage ad earnings" on public.ad_earnings;
create policy "Admins manage ad earnings"
  on public.ad_earnings for all
  using (public.is_admin())
  with check (public.is_admin());
