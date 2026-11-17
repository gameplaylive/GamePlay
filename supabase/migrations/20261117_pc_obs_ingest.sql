-- PC / OBS ingest credentials + community stream source fields

create extension if not exists "pgcrypto";

-- Per-user RTMP stream key for OBS / Streamlabs → live.gameplaylive.com
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

-- Inserts happen via service role / API (Pro check server-side)
create policy "Users insert own ingest credentials"
  on public.creator_ingest_credentials for insert
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

-- Extend community_live_streams for PC ingest + playback
alter table public.community_live_streams
  add column if not exists source text not null default 'mobile'
    check (source in ('mobile', 'pc', 'youtube'));

alter table public.community_live_streams
  add column if not exists playback_url text;

alter table public.community_live_streams
  add column if not exists ingest_stream_key text;
