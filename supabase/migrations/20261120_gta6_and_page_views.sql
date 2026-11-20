-- GTA 6 default game + lightweight site/app visit analytics

insert into public.games (id, title, slug, cover_image, twitch_game_id, youtube_query, is_active)
values (
  '11111111-1111-1111-1111-111111111112',
  'GTA 6',
  'gta-6',
  'https://static-cdn.jtvnw.net/ttv-boxart/1867279146_IGDB-285x380.jpg',
  '1867279146',
  'GTA 6',
  true
)
on conflict (id) do update set
  title = excluded.title,
  slug = excluded.slug,
  cover_image = excluded.cover_image,
  twitch_game_id = excluded.twitch_game_id,
  youtube_query = excluded.youtube_query,
  is_active = true;

-- If slug already exists under another id, activate/update that row
update public.games
set
  title = 'GTA 6',
  cover_image = 'https://static-cdn.jtvnw.net/ttv-boxart/1867279146_IGDB-285x380.jpg',
  twitch_game_id = '1867279146',
  youtube_query = 'GTA 6',
  is_active = true
where slug = 'gta-6';

create table if not exists public.analytics_page_views (
  id bigserial primary key,
  path text not null default '/',
  client text not null default 'web' check (client in ('web', 'android', 'ios', 'other')),
  anon_id text,
  user_id uuid references auth.users (id) on delete set null,
  referrer text,
  user_agent text,
  created_at timestamptz not null default now()
);

create index if not exists analytics_page_views_created_idx
  on public.analytics_page_views (created_at desc);

create index if not exists analytics_page_views_client_day_idx
  on public.analytics_page_views (client, created_at desc);

create index if not exists analytics_page_views_anon_idx
  on public.analytics_page_views (anon_id, created_at desc);

alter table public.analytics_page_views enable row level security;

grant select on public.analytics_page_views to authenticated;
