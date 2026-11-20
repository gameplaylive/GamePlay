-- Unify GTA V / GTA 6 into a single "GTA" discovery game

insert into public.games (id, title, slug, cover_image, twitch_game_id, youtube_query, is_active)
values (
  '11111111-1111-1111-1111-111111111101',
  'GTA',
  'gta',
  'https://static-cdn.jtvnw.net/ttv-boxart/1867279146_IGDB-285x380.jpg',
  '1867279146',
  'GTA',
  true
)
on conflict (id) do update set
  title = 'GTA',
  slug = 'gta',
  cover_image = excluded.cover_image,
  twitch_game_id = excluded.twitch_game_id,
  youtube_query = 'GTA',
  is_active = true;

-- Hide old split titles from catalogs
update public.games
set is_active = false
where slug in ('gta-v', 'gta-6') and id <> '11111111-1111-1111-1111-111111111101';

-- Remap live/video cache so GTA filter shows V + VI streams
update public.cached_streams
set game_slug = 'gta', game_title = 'GTA', game_id = '11111111-1111-1111-1111-111111111101'
where game_slug in ('gta-v', 'gta-6');

update public.cached_live_feeds
set game_slug = 'gta', game_title = 'GTA'
where game_slug in ('gta-v', 'gta-6');
