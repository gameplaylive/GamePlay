-- Cache recent VODs / uploads for My Gamers profiles (filled by favorites cron).
alter table public.tracked_creators
  add column if not exists recent_videos jsonb not null default '[]'::jsonb;
