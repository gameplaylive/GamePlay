-- FCM device tokens + admin campaigns + daily digest log

create table if not exists public.push_devices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles (id) on delete cascade,
  token text not null,
  platform text not null default 'web' check (platform in ('web', 'android', 'ios')),
  timezone text not null default 'UTC',
  country text,
  enabled boolean not null default true,
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (token)
);

create index if not exists push_devices_user_idx on public.push_devices (user_id);
create index if not exists push_devices_enabled_idx on public.push_devices (enabled) where enabled = true;

alter table public.push_devices enable row level security;

drop policy if exists "Users manage own push devices" on public.push_devices;
create policy "Users manage own push devices"
  on public.push_devices for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create table if not exists public.push_campaigns (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text not null,
  image_url text,
  deep_link text not null default '/',
  created_by uuid references public.profiles (id) on delete set null,
  sent_count int not null default 0,
  created_at timestamptz not null default now()
);

alter table public.push_campaigns enable row level security;

drop policy if exists "Admins read push campaigns" on public.push_campaigns;
create policy "Admins read push campaigns"
  on public.push_campaigns for select
  to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );

-- Daily digest de-dupe: one row per device per local slot per day
create table if not exists public.push_digest_log (
  id uuid primary key default gen_random_uuid(),
  device_id uuid not null references public.push_devices (id) on delete cascade,
  slot text not null check (slot in ('morning', 'evening', 'night')),
  local_date date not null,
  sent_at timestamptz not null default now(),
  unique (device_id, slot, local_date)
);

create index if not exists push_digest_log_date_idx on public.push_digest_log (local_date);

alter table public.push_digest_log enable row level security;
