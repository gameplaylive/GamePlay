-- Add Euro Truck Simulator 2 to discovery games
insert into public.games (id, title, slug, cover_image, twitch_game_id, youtube_query, is_active)
values (
  '11111111-1111-1111-1111-111111111111',
  'Euro Truck Simulator 2',
  'euro-truck-simulator-2',
  'https://static-cdn.jtvnw.net/ttv-boxart/75467_IGDB-285x380.jpg',
  '75467',
  'Euro Truck Simulator 2',
  true
)
on conflict (id) do update set
  title = excluded.title,
  slug = excluded.slug,
  cover_image = excluded.cover_image,
  twitch_game_id = excluded.twitch_game_id,
  youtube_query = excluded.youtube_query,
  is_active = true;
