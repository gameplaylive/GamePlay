-- Allow linked Twitch (and youtube link) sources on community_live_streams.
-- Zero-bandwidth Go Live: we only store embed IDs, never ingest video.

alter table public.community_live_streams
  drop constraint if exists community_live_streams_source_check;

alter table public.community_live_streams
  add constraint community_live_streams_source_check
  check (source in ('mobile', 'pc', 'youtube', 'twitch'));
