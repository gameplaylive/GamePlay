-- Quota-safe discovery: top-7 live feeds, tracked creators, daily YouTube quota

create extension if not exists "pgcrypto";

-- Daily YouTube quota accounting (search.list ≈ 100 units each)
create table if not exists public.youtube_quota_daily (
  day date primary key,
  search_list_calls integer not null default 0,
  units_estimated integer not null default 0,
  updated_at timestamptz not null default now()
);

alter table public.youtube_quota_daily enable row level security;

create policy "Admins read youtube quota"
  on public.youtube_quota_daily for select
  using (public.is_admin());

-- Broad YouTube live search payload (1 call / 20 min), classified locally
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

create index if not exists cached_live_feeds_game_idx
  on public.cached_live_feeds (platform, game_slug, viewer_count desc);

create index if not exists cached_live_feeds_fetched_idx
  on public.cached_live_feeds (fetched_at desc);

alter table public.cached_live_feeds enable row level security;

create policy "Anyone can read cached live feeds"
  on public.cached_live_feeds for select
  using (true);

create policy "Admins manage cached live feeds"
  on public.cached_live_feeds for all
  using (public.is_admin())
  with check (public.is_admin());

-- Shared creator directory + 24h search cache + shared live status
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
  pin_count integer not null default 0,
  last_checked_at timestamptz,
  search_cached_until timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (platform, channel_id)
);

create index if not exists tracked_creators_aliases_idx
  on public.tracked_creators using gin (search_aliases);

create index if not exists tracked_creators_login_idx
  on public.tracked_creators (platform, channel_login);

create index if not exists tracked_creators_pinned_idx
  on public.tracked_creators (platform, pin_count)
  where pin_count > 0;

alter table public.tracked_creators enable row level security;

create policy "Anyone can read tracked creators"
  on public.tracked_creators for select
  using (true);

create policy "Authenticated can insert tracked creators"
  on public.tracked_creators for insert
  to authenticated
  with check (true);

create policy "Authenticated can update tracked creators"
  on public.tracked_creators for update
  to authenticated
  using (true)
  with check (true);

-- Seed / normalize default games (superseded by 20261117_top10_default_games.sql)
insert into public.games (id, title, slug, cover_image, twitch_game_id, youtube_query, is_active)
values
  ('11111111-1111-1111-1111-111111111103', 'BGMI', 'bgmi', 'https://static-cdn.jtvnw.net/ttv-boxart/587342_IGDB-285x380.jpg', '587342', 'BGMI', true),
  ('11111111-1111-1111-1111-111111111106', 'Free Fire', 'free-fire', 'https://static-cdn.jtvnw.net/ttv-boxart/502732_IGDB-285x380.jpg', '502732', 'Free Fire', true),
  ('11111111-1111-1111-1111-111111111104', 'Valorant', 'valorant', 'https://static-cdn.jtvnw.net/ttv-boxart/516575_IGDB-285x380.jpg', '516575', 'Valorant', true),
  ('11111111-1111-1111-1111-111111111101', 'GTA V', 'gta-v', 'https://static-cdn.jtvnw.net/ttv-boxart/32982_IGDB-285x380.jpg', '32982', 'GTA V', true),
  ('11111111-1111-1111-1111-111111111102', 'Minecraft', 'minecraft', 'https://static-cdn.jtvnw.net/ttv-boxart/27471_IGDB-285x380.jpg', '27471', 'Minecraft', true),
  ('11111111-1111-1111-1111-111111111107', 'Roblox', 'roblox', 'https://static-cdn.jtvnw.net/ttv-boxart/23020_IGDB-285x380.jpg', '23020', 'Roblox', true),
  ('11111111-1111-1111-1111-111111111108', 'CS2', 'cs2', 'https://static-cdn.jtvnw.net/ttv-boxart/32399_IGDB-285x380.jpg', '32399', 'CS2', true)
on conflict (slug) do update set
  title = excluded.title,
  cover_image = excluded.cover_image,
  twitch_game_id = excluded.twitch_game_id,
  youtube_query = excluded.youtube_query,
  is_active = true;

update public.games
set is_active = false
where slug not in ('bgmi', 'free-fire', 'valorant', 'gta-v', 'minecraft', 'roblox', 'cs2');
