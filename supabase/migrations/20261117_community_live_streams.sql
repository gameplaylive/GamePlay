-- Community creators: direct-to-YouTube mobile screen streams (Pro)

create extension if not exists "pgcrypto";

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
  mic_enabled boolean not null default true
);

create index if not exists community_live_streams_live_idx
  on public.community_live_streams (is_live, started_at desc);

create index if not exists community_live_streams_user_idx
  on public.community_live_streams (user_id, is_live);

alter table public.community_live_streams enable row level security;

create policy "Anyone can read live community streams"
  on public.community_live_streams for select
  using (is_live = true or auth.uid() = user_id or public.is_admin());

create policy "Pro users can insert own community streams"
  on public.community_live_streams for insert
  to authenticated
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.subscription_tier = 'pro'
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

alter publication supabase_realtime add table public.community_live_streams;
