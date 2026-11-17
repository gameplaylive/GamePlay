-- Esports Tournament Centre — custom_tournaments
-- Run in Supabase SQL Editor (or apply via CLI) if schema.sql was already loaded.

create extension if not exists "pgcrypto";

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

create index if not exists custom_tournaments_featured_idx
  on public.custom_tournaments (is_featured, start_time);

alter table public.custom_tournaments enable row level security;

drop policy if exists "Anyone can read custom tournaments" on public.custom_tournaments;
create policy "Anyone can read custom tournaments"
  on public.custom_tournaments for select
  using (true);

drop policy if exists "Admins manage custom tournaments" on public.custom_tournaments;
create policy "Admins manage custom tournaments"
  on public.custom_tournaments for all
  using (public.is_admin())
  with check (public.is_admin());

-- Sample mobile esports rows (safe to re-run)
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
