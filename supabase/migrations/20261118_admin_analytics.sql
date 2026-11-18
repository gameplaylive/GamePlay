-- Admin analytics: watch-session telemetry + aggregation views (admin-only)

-- ---------------------------------------------------------------------------
-- watch_sessions — heartbeat telemetry from the watch page
-- ---------------------------------------------------------------------------
create table if not exists public.watch_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles (id) on delete set null,
  stream_id text not null,
  stream_title text not null default '',
  streamer_name text not null default '',
  game_slug text not null default '',
  game_title text not null default '',
  content_type text not null default 'live'
    check (content_type in ('live', 'video', 'trending', 'tournament')),
  platform text not null default 'youtube',
  started_at timestamptz not null default now(),
  last_heartbeat_at timestamptz not null default now(),
  duration_seconds integer not null default 0 check (duration_seconds >= 0),
  ended_at timestamptz
);

create index if not exists watch_sessions_user_idx
  on public.watch_sessions (user_id, started_at desc);

create index if not exists watch_sessions_stream_idx
  on public.watch_sessions (stream_id, started_at desc);

create index if not exists watch_sessions_game_idx
  on public.watch_sessions (game_slug, started_at desc);

create index if not exists watch_sessions_content_idx
  on public.watch_sessions (content_type, duration_seconds desc);

create index if not exists watch_sessions_streamer_idx
  on public.watch_sessions (streamer_name, duration_seconds desc);

alter table public.watch_sessions enable row level security;

drop policy if exists "Users insert own watch sessions" on public.watch_sessions;
create policy "Users insert own watch sessions"
  on public.watch_sessions for insert
  to authenticated
  with check (auth.uid() = user_id or user_id is null);

drop policy if exists "Users update own watch sessions" on public.watch_sessions;
create policy "Users update own watch sessions"
  on public.watch_sessions for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Admins read watch sessions" on public.watch_sessions;
create policy "Admins read watch sessions"
  on public.watch_sessions for select
  using (public.is_admin() or auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- Aggregation views (security_invoker so RLS still applies)
-- ---------------------------------------------------------------------------
create or replace view public.admin_user_overview
with (security_invoker = true)
as
select
  (select count(*)::bigint from public.profiles) as total_users,
  (
    select count(*)::bigint
    from public.profiles
    where subscription_tier = 'pro'
      and (pro_expires_at is null or pro_expires_at > now())
  ) as active_subscribers,
  (
    select count(*)::bigint
    from public.profiles
    where coalesce(is_banned, false) = true
  ) as banned_users,
  (
    select count(*)::bigint
    from public.profiles
    where role = 'admin'
  ) as admin_users;

create or replace view public.admin_pro_subscribers
with (security_invoker = true)
as
select
  id,
  email,
  full_name,
  avatar_url,
  subscription_tier,
  payment_provider,
  cashfree_subscription_id,
  pro_expires_at,
  updated_at,
  case
    when subscription_tier = 'pro'
      and (pro_expires_at is null or pro_expires_at > now())
      then 'active'
    when subscription_tier = 'pro' and pro_expires_at is not null and pro_expires_at <= now()
      then 'expired'
    else 'inactive'
  end as subscription_status
from public.profiles
where subscription_tier = 'pro'
order by updated_at desc;

create or replace view public.admin_top_creators
with (security_invoker = true)
as
select
  streamer_name,
  max(platform) as platform,
  count(*)::bigint as watch_count,
  coalesce(sum(duration_seconds), 0)::bigint as total_watch_seconds,
  round(avg(duration_seconds) / 60.0, 2) as avg_minutes_per_session
from public.watch_sessions
where coalesce(streamer_name, '') <> ''
group by streamer_name
order by total_watch_seconds desc, watch_count desc;

create or replace view public.admin_top_streams
with (security_invoker = true)
as
select
  stream_id,
  max(stream_title) as stream_title,
  max(streamer_name) as streamer_name,
  max(game_slug) as game_slug,
  max(game_title) as game_title,
  max(content_type) as content_type,
  max(platform) as platform,
  count(*)::bigint as watch_count,
  coalesce(sum(duration_seconds), 0)::bigint as total_watch_seconds,
  round(avg(duration_seconds) / 60.0, 2) as avg_minutes_per_session
from public.watch_sessions
group by stream_id
order by total_watch_seconds desc, watch_count desc;

create or replace view public.admin_game_engagement
with (security_invoker = true)
as
select
  coalesce(nullif(game_slug, ''), 'unknown') as game_slug,
  coalesce(nullif(max(game_title), ''), coalesce(nullif(game_slug, ''), 'Unknown')) as game_title,
  count(*)::bigint as watch_count,
  coalesce(sum(duration_seconds), 0)::bigint as total_watch_seconds,
  round(avg(duration_seconds) / 60.0, 2) as avg_minutes_per_session,
  count(distinct user_id)::bigint as unique_viewers
from public.watch_sessions
group by coalesce(nullif(game_slug, ''), 'unknown')
order by total_watch_seconds desc, watch_count desc;

-- Restrict view access: only admins (via RLS on underlying tables + grant)
revoke all on public.admin_user_overview from anon, authenticated;
revoke all on public.admin_pro_subscribers from anon, authenticated;
revoke all on public.admin_top_creators from anon, authenticated;
revoke all on public.admin_top_streams from anon, authenticated;
revoke all on public.admin_game_engagement from anon, authenticated;

grant select on public.admin_user_overview to authenticated, service_role;
grant select on public.admin_pro_subscribers to authenticated, service_role;
grant select on public.admin_top_creators to authenticated, service_role;
grant select on public.admin_top_streams to authenticated, service_role;
grant select on public.admin_game_engagement to authenticated, service_role;
