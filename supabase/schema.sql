-- GamePlay Live complete schema + RLS + seeds
-- Run in Supabase SQL Editor after creating your project.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  full_name text,
  avatar_url text,
  role text not null default 'user' check (role in ('user', 'admin')),
  favorite_games text[] not null default '{}',
  preferred_language text not null default 'All',
  subscription_tier text not null default 'free' check (subscription_tier in ('free', 'pro')),
  payment_provider text not null default 'cashfree',
  cashfree_subscription_id text,
  pro_expires_at timestamptz,
  stripe_customer_id text,
  is_banned boolean not null default false,
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin' and coalesce(p.is_banned, false) = false
  );
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  initial_role text := 'user';
begin
  -- Platform owner — only this Google email becomes admin on first login
  if lower(coalesce(new.email, '')) = 'gameliveapp@gmail.com' then
    initial_role := 'admin';
  end if;

  insert into public.profiles (id, email, full_name, avatar_url, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', ''),
    coalesce(new.raw_user_meta_data->>'avatar_url', new.raw_user_meta_data->>'picture', ''),
    initial_role
  )
  on conflict (id) do update set
    email = excluded.email,
    full_name = coalesce(nullif(excluded.full_name, ''), profiles.full_name),
    avatar_url = coalesce(nullif(excluded.avatar_url, ''), profiles.avatar_url),
    role = case
      when lower(coalesce(excluded.email, '')) = 'gameliveapp@gmail.com' then 'admin'
      else profiles.role
    end,
    updated_at = now();
  return new;
end;
$$;

-- Block non-admins from changing role / Pro / ban / Stripe fields on their own row
create or replace function public.protect_profile_privileges()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    return new;
  end if;
  if not public.is_admin() then
    new.role := old.role;
    new.subscription_tier := old.subscription_tier;
    new.is_banned := old.is_banned;
    new.stripe_customer_id := old.stripe_customer_id;
    new.payment_provider := old.payment_provider;
    new.cashfree_subscription_id := old.cashfree_subscription_id;
    new.pro_expires_at := old.pro_expires_at;
  end if;
  return new;
end;
$$;

drop trigger if exists protect_profile_privileges on public.profiles;
create trigger protect_profile_privileges
  before update on public.profiles
  for each row execute function public.protect_profile_privileges();

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create policy "Users can read own profile"
  on public.profiles for select
  using (auth.uid() = id or public.is_admin());

create policy "Users can update own non-privileged fields"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

create policy "Admins can update any profile"
  on public.profiles for update
  using (public.is_admin())
  with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- app_settings (single-row vault)
-- ---------------------------------------------------------------------------
create table if not exists public.app_settings (
  id int primary key default 1 check (id = 1),
  pro_price_usd numeric(10,2) not null default 99.00,
  pro_plan_name text not null default 'GamePlay Live Pro',
  pro_plan_description text not null default 'Ad-free streaming, 2x2 Multi-Stream Grid, and Gold Pro Badge',
  stripe_price_id text not null default '',
  stripe_secret_key text not null default '',
  stripe_webhook_secret text not null default '',
  cashfree_app_id text not null default '',
  cashfree_secret_key text not null default '',
  cashfree_env text not null default 'sandbox' check (cashfree_env in ('sandbox', 'production')),
  youtube_api_key text not null default '',
  twitch_client_id text not null default '',
  twitch_client_secret text not null default '',
  adsense_enabled boolean not null default true,
  adsense_publisher_id text not null default '',
  adsense_slot_id text not null default '',
  admob_enabled boolean not null default true,
  admob_app_id text not null default '',
  admob_banner_unit_id text not null default '',
  last_sync_time timestamptz
);

alter table public.app_settings enable row level security;

insert into public.app_settings (id)
values (1)
on conflict (id) do nothing;

-- Public display fields via a security-invoker view (no secrets)
create or replace view public.app_settings_public
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

create policy "Authenticated can read public app settings row"
  on public.app_settings for select
  to authenticated
  using (true);

create policy "Admins full access to app_settings"
  on public.app_settings for all
  using (public.is_admin())
  with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- games
-- ---------------------------------------------------------------------------
create table if not exists public.games (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  slug text not null unique,
  cover_image text not null default '',
  twitch_game_id text not null default '',
  youtube_query text not null default '',
  is_active boolean not null default true
);

alter table public.games enable row level security;

create policy "Anyone can read active games"
  on public.games for select
  using (is_active = true or public.is_admin());

create policy "Admins manage games"
  on public.games for all
  using (public.is_admin())
  with check (public.is_admin());

insert into public.games (id, title, slug, cover_image, twitch_game_id, youtube_query, is_active)
values
  ('11111111-1111-1111-1111-111111111103', 'BGMI', 'bgmi', 'https://static-cdn.jtvnw.net/ttv-boxart/587342_IGDB-285x380.jpg', '587342', 'BGMI', true),
  ('11111111-1111-1111-1111-111111111106', 'Free Fire', 'free-fire', 'https://static-cdn.jtvnw.net/ttv-boxart/502732_IGDB-285x380.jpg', '502732', 'Free Fire', true),
  ('11111111-1111-1111-1111-111111111104', 'Valorant', 'valorant', 'https://static-cdn.jtvnw.net/ttv-boxart/516575_IGDB-285x380.jpg', '516575', 'Valorant', true),
  ('11111111-1111-1111-1111-111111111101', 'GTA V', 'gta-v', 'https://static-cdn.jtvnw.net/ttv-boxart/32982_IGDB-285x380.jpg', '32982', 'GTA V', true),
  ('11111111-1111-1111-1111-111111111102', 'Minecraft', 'minecraft', 'https://static-cdn.jtvnw.net/ttv-boxart/27471_IGDB-285x380.jpg', '27471', 'Minecraft', true),
  ('11111111-1111-1111-1111-111111111107', 'Roblox', 'roblox', 'https://static-cdn.jtvnw.net/ttv-boxart/23020_IGDB-285x380.jpg', '23020', 'Roblox', true),
  ('11111111-1111-1111-1111-111111111108', 'CS2', 'cs2', 'https://static-cdn.jtvnw.net/ttv-boxart/32399_IGDB-285x380.jpg', '32399', 'CS2', true),
  ('11111111-1111-1111-1111-111111111109', 'Dota 2', 'dota-2', 'https://static-cdn.jtvnw.net/ttv-boxart/29595_IGDB-285x380.jpg', '29595', 'Dota 2', true),
  ('11111111-1111-1111-1111-111111111105', 'Fortnite', 'fortnite', 'https://static-cdn.jtvnw.net/ttv-boxart/33214_IGDB-285x380.jpg', '33214', 'Fortnite', true),
  ('11111111-1111-1111-1111-111111111110', 'Call of Duty', 'call-of-duty', 'https://static-cdn.jtvnw.net/ttv-boxart/512710_IGDB-285x380.jpg', '512710', 'Call of Duty', true)
on conflict (slug) do update set
  title = excluded.title,
  twitch_game_id = excluded.twitch_game_id,
  youtube_query = excluded.youtube_query,
  is_active = true;

update public.games
set is_active = false
where slug not in (
  'bgmi', 'free-fire', 'valorant', 'gta-v', 'minecraft',
  'roblox', 'cs2', 'dota-2', 'fortnite', 'call-of-duty'
);

-- ---------------------------------------------------------------------------
-- cached_streams (live + latest + trending)
-- ---------------------------------------------------------------------------
create table if not exists public.cached_streams (
  id uuid primary key default gen_random_uuid(),
  game_id uuid references public.games (id) on delete set null,
  game_slug text not null default '',
  game_title text not null default '',
  content_type text not null check (content_type in ('live', 'video', 'trending')),
  platform text not null check (platform in ('youtube', 'twitch')),
  external_id text not null,
  title text not null,
  streamer_name text not null default '',
  thumbnail_url text not null default '',
  viewer_count integer not null default 0,
  published_at timestamptz,
  language text not null default 'English',
  updated_at timestamptz not null default now()
);

create index if not exists cached_streams_content_type_idx on public.cached_streams (content_type);
create index if not exists cached_streams_game_slug_idx on public.cached_streams (game_slug);
create index if not exists cached_streams_platform_external_idx on public.cached_streams (platform, external_id);

alter table public.cached_streams enable row level security;

create policy "Anyone can read cached streams"
  on public.cached_streams for select
  using (true);

create policy "Service and admins write cached streams"
  on public.cached_streams for all
  using (public.is_admin())
  with check (public.is_admin());

insert into public.cached_streams (
  id, game_id, game_slug, game_title, content_type, platform, external_id,
  title, streamer_name, thumbnail_url, viewer_count, published_at, language
) values
  (
    '22222222-2222-2222-2222-222222222201',
    '11111111-1111-1111-1111-111111111104',
    'valorant', 'Valorant', 'live', 'twitch', 'valorant',
    'RANKED GRIND — Immortal lobby chaos', 'NeonAce',
    'https://static-cdn.jtvnw.net/previews-ttv/live_user_valorant-1280x720.jpg',
    18420, now() - interval '12 minutes', 'English'
  ),
  (
    '22222222-2222-2222-2222-222222222202',
    '11111111-1111-1111-1111-111111111101',
    'gta-v', 'GTA V', 'live', 'youtube', 'dQw4w9WgXcQ',
    'NoPixel vibes — heist night LIVE', 'CityChaosTV',
    'https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg',
    9320, now() - interval '25 minutes', 'English'
  ),
  (
    '22222222-2222-2222-2222-222222222203',
    '11111111-1111-1111-1111-111111111103',
    'bgmi', 'BGMI / PUBG Mobile', 'live', 'twitch', 'pubgmobile',
    'BGMI Scrims — Drop hot or die trying', 'DropZoneIN',
    'https://static-cdn.jtvnw.net/previews-ttv/live_user_pubgmobile-1280x720.jpg',
    22100, now() - interval '8 minutes', 'Hindi'
  ),
  (
    '22222222-2222-2222-2222-222222222204',
    '11111111-1111-1111-1111-111111111105',
    'fortnite', 'Fortnite', 'live', 'twitch', 'fortnite',
    'Arena W-key only — chill chat', 'BuildGod',
    'https://static-cdn.jtvnw.net/previews-ttv/live_user_fortnite-1280x720.jpg',
    15400, now() - interval '3 minutes', 'English'
  ),
  (
    '22222222-2222-2222-2222-222222222205',
    '11111111-1111-1111-1111-111111111102',
    'minecraft', 'Minecraft', 'video', 'youtube', 'jNQXAC9IVRw',
    'Hardcore 100 Days — Episode Finale', 'CraftLegacy',
    'https://i.ytimg.com/vi/jNQXAC9IVRw/hqdefault.jpg',
    0, now() - interval '2 hours', 'English'
  ),
  (
    '22222222-2222-2222-2222-222222222206',
    '11111111-1111-1111-1111-111111111106',
    'free-fire', 'Free Fire', 'video', 'youtube', '9bZkp7q19f0',
    'CS Rank Push — clutch compilation', 'FFClutchKing',
    'https://i.ytimg.com/vi/9bZkp7q19f0/hqdefault.jpg',
    0, now() - interval '5 hours', 'Hindi'
  ),
  (
    '22222222-2222-2222-2222-222222222207',
    '11111111-1111-1111-1111-111111111104',
    'valorant', 'Valorant', 'video', 'twitch', 'v123456789',
    'VCT watch party highlights', 'AceReplay',
    'https://static-cdn.jtvnw.net/ttv-boxart/516575_IGDB-285x380.jpg',
    0, now() - interval '1 day', 'English'
  ),
  (
    '22222222-2222-2222-2222-222222222208',
    '11111111-1111-1111-1111-111111111101',
    'gta-v', 'GTA V', 'video', 'youtube', 'kJQP7kiw5Fk',
    'Best GTA moments this week', 'LosSantosCuts',
    'https://i.ytimg.com/vi/kJQP7kiw5Fk/hqdefault.jpg',
    0, now() - interval '18 hours', 'English'
  )
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- chat / polls
-- ---------------------------------------------------------------------------
create table if not exists public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  stream_id uuid not null references public.cached_streams (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  user_name text not null default '',
  user_avatar text not null default '',
  is_pro boolean not null default false,
  message text not null check (char_length(message) <= 500),
  created_at timestamptz not null default now()
);

create index if not exists chat_messages_stream_idx on public.chat_messages (stream_id, created_at desc);

alter table public.chat_messages enable row level security;

create policy "Anyone authenticated can read chat"
  on public.chat_messages for select
  to authenticated
  using (true);

create policy "Users can insert own chat"
  on public.chat_messages for insert
  to authenticated
  with check (auth.uid() = user_id);

create table if not exists public.live_polls (
  id uuid primary key default gen_random_uuid(),
  stream_id uuid not null references public.cached_streams (id) on delete cascade,
  question text not null,
  option_a text not null,
  option_b text not null,
  votes_a integer not null default 0,
  votes_b integer not null default 0,
  is_active boolean not null default true
);

alter table public.live_polls enable row level security;

create policy "Anyone can read polls"
  on public.live_polls for select
  using (true);

create policy "Admins manage polls"
  on public.live_polls for all
  using (public.is_admin())
  with check (public.is_admin());

create table if not exists public.poll_votes (
  id uuid primary key default gen_random_uuid(),
  poll_id uuid not null references public.live_polls (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  selected_option text not null check (selected_option in ('a', 'b')),
  unique (poll_id, user_id)
);

alter table public.poll_votes enable row level security;

create policy "Users read own votes"
  on public.poll_votes for select
  to authenticated
  using (auth.uid() = user_id or public.is_admin());

create policy "Users cast one vote"
  on public.poll_votes for insert
  to authenticated
  with check (auth.uid() = user_id);

create or replace function public.cast_poll_vote(p_poll_id uuid, p_option text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_option not in ('a', 'b') then
    raise exception 'invalid option';
  end if;

  insert into public.poll_votes (poll_id, user_id, selected_option)
  values (p_poll_id, auth.uid(), p_option);

  if p_option = 'a' then
    update public.live_polls set votes_a = votes_a + 1 where id = p_poll_id and is_active = true;
  else
    update public.live_polls set votes_b = votes_b + 1 where id = p_poll_id and is_active = true;
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- user_favorites (favorite gamers / creators)
-- ---------------------------------------------------------------------------
create table if not exists public.user_favorites (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  channel_name text not null,
  platform text not null check (platform in ('youtube', 'twitch')),
  channel_id_or_username text not null,
  avatar_url text not null default '',
  created_at timestamptz not null default now(),
  unique (user_id, platform, channel_id_or_username)
);

create index if not exists user_favorites_user_idx on public.user_favorites (user_id, created_at desc);

alter table public.user_favorites enable row level security;

create policy "Users manage own favorites"
  on public.user_favorites for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- custom_tournaments (mobile / regional esports not covered by PandaScore)
-- ---------------------------------------------------------------------------
create table if not exists public.custom_tournaments (
  id uuid primary key default gen_random_uuid(),
  tournament_name text not null,
  game text not null,
  match_title text not null default '',
  start_time timestamptz not null,
  end_time timestamptz,
  platform text not null default 'youtube' check (platform in ('youtube', 'twitch')),
  channel_id text not null default '',
  fallback_stream_url text not null default '',
  is_featured boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists custom_tournaments_start_time_idx
  on public.custom_tournaments (start_time);

alter table public.custom_tournaments enable row level security;

create policy "Anyone can read custom tournaments"
  on public.custom_tournaments for select
  using (true);

create policy "Admins manage custom tournaments"
  on public.custom_tournaments for all
  using (public.is_admin())
  with check (public.is_admin());

insert into public.custom_tournaments (
  id, tournament_name, game, match_title, start_time, end_time,
  platform, channel_id, fallback_stream_url, is_featured
) values
  (
    '33333333-3333-3333-3333-333333333301',
    'BGIS 2026 Grand Finals',
    'BGMI',
    'Day 3 — Finals Lobby',
    now() + interval '2 hours',
    now() + interval '6 hours',
    'youtube',
    '',
    'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    true
  ),
  (
    '33333333-3333-3333-3333-333333333302',
    'Free Fire World Series IN',
    'Free Fire',
    'Semi Finals — Booyah Stage',
    now() - interval '30 minutes',
    now() + interval '3 hours',
    'youtube',
    '',
    'https://www.youtube.com/watch?v=jNQXAC9IVRw',
    true
  ),
  (
    '33333333-3333-3333-3333-333333333303',
    'BGMI Challengers Cup',
    'BGMI',
    'Qualifier Week 2',
    now() + interval '1 day',
    now() + interval '1 day 4 hours',
    'twitch',
    'pubgmobile',
    '',
    true
  )
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- special_events (manual game shows / specials)
-- ---------------------------------------------------------------------------
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

-- ---------------------------------------------------------------------------
-- event_reminders (4-stage smart reminders)
-- ---------------------------------------------------------------------------
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

-- ---------------------------------------------------------------------------
-- in_app_notifications (navbar bell)
-- ---------------------------------------------------------------------------
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

-- ---------------------------------------------------------------------------
-- community_live_streams (Pro creators → YouTube RTMP from phone)
-- ---------------------------------------------------------------------------
create table if not exists public.creator_ingest_credentials (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  stream_key text not null unique,
  pending_title text not null default 'Live on GamePlay Live',
  pending_game text not null default 'Other',
  is_active boolean not null default true,
  last_published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id)
);

create index if not exists creator_ingest_credentials_key_idx
  on public.creator_ingest_credentials (stream_key)
  where is_active = true;

alter table public.creator_ingest_credentials enable row level security;

create policy "Users read own ingest credentials"
  on public.creator_ingest_credentials for select
  to authenticated
  using (auth.uid() = user_id or public.is_admin());

create policy "Users update own ingest pending meta"
  on public.creator_ingest_credentials for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users insert own ingest credentials"
  on public.creator_ingest_credentials for insert
  to authenticated
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and coalesce(p.is_banned, false) = false
    )
  );

create table if not exists public.community_live_streams (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  creator_name text not null,
  game text not null check (
    game in ('BGMI', 'Free Fire', 'Minecraft', 'Roblox', 'Valorant', 'GTA V', 'Other')
  ),
  stream_title text not null,
  youtube_video_id text,
  is_live boolean not null default true,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  resolution text not null default '720p60',
  mic_enabled boolean not null default true,
  source text not null default 'mobile' check (source in ('mobile', 'pc', 'youtube', 'twitch')),
  playback_url text,
  ingest_stream_key text
);

create index if not exists community_live_streams_live_idx
  on public.community_live_streams (is_live, started_at desc);

create index if not exists community_live_streams_user_idx
  on public.community_live_streams (user_id, is_live);

alter table public.community_live_streams enable row level security;

create policy "Anyone can read live community streams"
  on public.community_live_streams for select
  using (is_live = true or auth.uid() = user_id or public.is_admin());

create policy "Signed-in users can insert own community streams"
  on public.community_live_streams for insert
  to authenticated
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and coalesce(p.is_banned, false) = false
    )
  );

create policy "Users can update own community streams"
  on public.community_live_streams for update
  to authenticated
  using (auth.uid() = user_id or public.is_admin())
  with check (auth.uid() = user_id or public.is_admin());

create policy "Users can delete own community streams"
  on public.community_live_streams for delete
  to authenticated
  using (auth.uid() = user_id or public.is_admin());

-- ---------------------------------------------------------------------------
-- youtube_quota_daily / cached_live_feeds / tracked_creators
-- (see also migrations/20261117_quota_favorites_discovery.sql)
-- ---------------------------------------------------------------------------
create table if not exists public.youtube_quota_daily (
  day date primary key,
  search_list_calls integer not null default 0,
  units_estimated integer not null default 0,
  updated_at timestamptz not null default now()
);

alter table public.youtube_quota_daily enable row level security;

create table if not exists public.cached_live_feeds (
  id uuid primary key default gen_random_uuid(),
  platform text not null check (platform in ('youtube', 'twitch')),
  game_slug text not null default '',
  game_title text not null default '',
  external_id text not null,
  title text not null,
  streamer_name text not null default '',
  channel_id text not null default '',
  thumbnail_url text not null default '',
  viewer_count integer not null default 0,
  published_at timestamptz,
  language text not null default 'English',
  raw jsonb not null default '{}'::jsonb,
  fetched_at timestamptz not null default now(),
  unique (platform, external_id)
);

alter table public.cached_live_feeds enable row level security;

create policy "Anyone can read cached live feeds"
  on public.cached_live_feeds for select
  using (true);

create table if not exists public.tracked_creators (
  id uuid primary key default gen_random_uuid(),
  platform text not null check (platform in ('youtube', 'twitch')),
  channel_id text not null,
  channel_login text not null default '',
  channel_name text not null,
  avatar_url text not null default '',
  uploads_playlist_id text,
  search_aliases text[] not null default '{}',
  is_live boolean not null default false,
  live_title text,
  live_video_id text,
  live_viewer_count integer not null default 0,
  live_thumbnail text,
  latest_video_id text,
  latest_video_title text,
  latest_video_thumbnail text,
  recent_videos jsonb not null default '[]'::jsonb,
  pin_count integer not null default 0,
  last_checked_at timestamptz,
  search_cached_until timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (platform, channel_id)
);

alter table public.tracked_creators enable row level security;

create policy "Anyone can read tracked creators"
  on public.tracked_creators for select
  using (true);

-- ---------------------------------------------------------------------------
-- watch_sessions + admin analytics views
-- (full DDL also in migrations/20261118_admin_analytics.sql)
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

create index if not exists watch_sessions_game_idx on public.watch_sessions (game_slug, started_at desc);
create index if not exists watch_sessions_streamer_idx on public.watch_sessions (streamer_name, duration_seconds desc);

alter table public.watch_sessions enable row level security;

-- ---------------------------------------------------------------------------
-- Realtime
-- ---------------------------------------------------------------------------
alter publication supabase_realtime add table public.chat_messages;
alter publication supabase_realtime add table public.live_polls;
alter publication supabase_realtime add table public.in_app_notifications;
alter publication supabase_realtime add table public.community_live_streams;

-- ---------------------------------------------------------------------------
-- Column-level protection for secrets (admins still need SELECT for vault UI;
-- never expose secrets via anon client — use service role on server).
-- ---------------------------------------------------------------------------
revoke all on public.app_settings from anon;
grant select (
  id, pro_price_usd, pro_plan_name, pro_plan_description,
  adsense_enabled, adsense_publisher_id, adsense_slot_id,
  admob_enabled, admob_app_id, admob_banner_unit_id, last_sync_time
) on public.app_settings to authenticated;

grant select, update on public.app_settings to authenticated;
-- Note: non-admin updates blocked by RLS; admins pass is_admin().

-- ---------------------------------------------------------------------------
-- squad_posts (Squad Finder LFG)
-- ---------------------------------------------------------------------------
create table if not exists public.squad_posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  creator_name text not null default '',
  is_pro boolean not null default false,
  game text not null,
  mode text not null,
  mic_required boolean not null default true,
  in_game_id text not null,
  note text not null default '',
  expires_at timestamptz not null default (now() + interval '3 hours'),
  created_at timestamptz not null default now(),
  constraint squad_posts_note_len check (char_length(note) <= 120),
  constraint squad_posts_in_game_id_len check (char_length(in_game_id) >= 2 and char_length(in_game_id) <= 48),
  constraint squad_posts_game_len check (char_length(game) >= 2 and char_length(game) <= 40),
  constraint squad_posts_mode_len check (char_length(mode) >= 2 and char_length(mode) <= 40)
);

create index if not exists squad_posts_active_idx
  on public.squad_posts (expires_at asc, is_pro desc, created_at desc);
create index if not exists squad_posts_user_created_idx
  on public.squad_posts (user_id, created_at desc);
create index if not exists squad_posts_game_idx
  on public.squad_posts (game, expires_at desc);

alter table public.squad_posts enable row level security;

drop policy if exists "Anyone can read active squad posts" on public.squad_posts;
create policy "Anyone can read active squad posts"
  on public.squad_posts for select
  using (expires_at > now());

drop policy if exists "Users insert own squad posts" on public.squad_posts;
create policy "Users insert own squad posts"
  on public.squad_posts for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "Users delete own squad posts" on public.squad_posts;
create policy "Users delete own squad posts"
  on public.squad_posts for delete
  to authenticated
  using (auth.uid() = user_id);

grant select on public.squad_posts to anon, authenticated;
grant insert, delete on public.squad_posts to authenticated;
