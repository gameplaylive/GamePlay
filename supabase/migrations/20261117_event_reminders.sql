-- Upcoming Events reminders + in-app notifications + special events

create extension if not exists "pgcrypto";

-- Manual game shows / special broadcasts
create table if not exists public.special_events (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  game_name text not null default 'Multi',
  category text not null default 'game_show' check (category in ('game_show', 'gameplay', 'tournament')),
  start_time timestamptz not null,
  stream_url text not null default '',
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.special_events enable row level security;

create policy "Anyone can read special events"
  on public.special_events for select
  using (is_active = true or public.is_admin());

create policy "Admins manage special events"
  on public.special_events for all
  using (public.is_admin())
  with check (public.is_admin());

insert into public.special_events (id, title, game_name, category, start_time, stream_url, is_active)
values
  (
    '44444444-4444-4444-4444-444444444401',
    'Summer Game Fest Showcase',
    'Multi',
    'game_show',
    now() + interval '3 days',
    'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    true
  ),
  (
    '44444444-4444-4444-4444-444444444402',
    'Nintendo Direct Mini',
    'Nintendo',
    'game_show',
    now() + interval '36 hours',
    'https://www.youtube.com/watch?v=jNQXAC9IVRw',
    true
  )
on conflict (id) do nothing;

create table if not exists public.event_reminders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  user_email text,
  push_subscription jsonb,
  event_id text not null,
  event_title text not null,
  event_type text not null check (event_type in ('tournament', 'game_show', 'gameplay')),
  stream_url text not null default '',
  event_start_time timestamptz not null,
  notified_48h boolean not null default false,
  notified_24h boolean not null default false,
  notified_30m boolean not null default false,
  notified_live boolean not null default false,
  created_at timestamptz not null default now(),
  unique (user_id, event_id)
);

create index if not exists event_reminders_pending_idx
  on public.event_reminders (notified_live, event_start_time);

alter table public.event_reminders enable row level security;

create policy "Users manage own reminders"
  on public.event_reminders for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create table if not exists public.in_app_notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null,
  body text not null,
  link_url text not null default '',
  event_id text,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists in_app_notifications_user_idx
  on public.in_app_notifications (user_id, is_read, created_at desc);

alter table public.in_app_notifications enable row level security;

create policy "Users read own notifications"
  on public.in_app_notifications for select
  to authenticated
  using (auth.uid() = user_id);

create policy "Users update own notifications"
  on public.in_app_notifications for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users delete own notifications"
  on public.in_app_notifications for delete
  to authenticated
  using (auth.uid() = user_id);

-- Inserts for notifications use service role from cron
