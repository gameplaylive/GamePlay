-- Launch hardening: squad membership, tournament reminders, favorite-live dedupe, RLS tighten

-- ---------------------------------------------------------------------------
-- Squad Finder membership
-- ---------------------------------------------------------------------------
alter table public.squad_posts
  add column if not exists max_slots integer not null default 4,
  add column if not exists slots_filled integer not null default 1,
  add column if not exists joined_user_ids uuid[] not null default '{}';

alter table public.squad_posts drop constraint if exists squad_posts_slots_check;
alter table public.squad_posts
  add constraint squad_posts_slots_check
  check (slots_filled >= 1 and slots_filled <= max_slots and max_slots between 2 and 8);

drop policy if exists "Users update own squad posts" on public.squad_posts;
create policy "Users update own squad posts"
  on public.squad_posts for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

grant update on public.squad_posts to authenticated;

-- ---------------------------------------------------------------------------
-- Tournament Notify Me (server-backed)
-- ---------------------------------------------------------------------------
create table if not exists public.tournament_reminders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  tournament_id text not null,
  tournament_title text not null default '',
  game text not null default '',
  start_time timestamptz,
  watch_path text,
  notified boolean not null default false,
  created_at timestamptz not null default now(),
  unique (user_id, tournament_id)
);

create index if not exists tournament_reminders_pending_idx
  on public.tournament_reminders (notified, start_time)
  where notified = false;

alter table public.tournament_reminders enable row level security;

drop policy if exists "Users manage own tournament reminders" on public.tournament_reminders;
create policy "Users manage own tournament reminders"
  on public.tournament_reminders for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

grant select, insert, update, delete on public.tournament_reminders to authenticated;

-- ---------------------------------------------------------------------------
-- Favorite gamer went-live push dedupe (one notify per live session)
-- ---------------------------------------------------------------------------
create table if not exists public.favorite_live_alerts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  creator_id uuid not null references public.tracked_creators (id) on delete cascade,
  live_session_key text not null,
  created_at timestamptz not null default now(),
  unique (user_id, creator_id, live_session_key)
);

create index if not exists favorite_live_alerts_creator_idx
  on public.favorite_live_alerts (creator_id, live_session_key);

alter table public.favorite_live_alerts enable row level security;
-- service-role cron only; no client policies

-- ---------------------------------------------------------------------------
-- Push tables (mirror firebase migration into hardening for schema sync)
-- ---------------------------------------------------------------------------
create table if not exists public.push_devices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete cascade,
  token text not null unique,
  platform text not null default 'web',
  enabled boolean not null default true,
  timezone text,
  locale text,
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table if not exists public.push_campaigns (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text not null,
  image_url text,
  link_url text,
  sent_by uuid references auth.users (id) on delete set null,
  sent_count integer not null default 0,
  fail_count integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.push_digest_log (
  id uuid primary key default gen_random_uuid(),
  device_id uuid not null references public.push_devices (id) on delete cascade,
  slot text not null,
  local_date date not null,
  created_at timestamptz not null default now(),
  unique (device_id, slot, local_date)
);

-- ---------------------------------------------------------------------------
-- Tighten tracked_creators RLS: public read; writes = service role / admin only
-- ---------------------------------------------------------------------------
drop policy if exists "Authenticated can insert tracked creators" on public.tracked_creators;
drop policy if exists "Authenticated can update tracked creators" on public.tracked_creators;
drop policy if exists "Authenticated insert tracked creators" on public.tracked_creators;
drop policy if exists "Authenticated update tracked creators" on public.tracked_creators;

-- Keep public/authenticated SELECT; mutations go through service role APIs
