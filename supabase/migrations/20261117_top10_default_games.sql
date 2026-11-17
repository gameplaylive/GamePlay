-- Expand default discovery catalog from 7 → 10 games (same YouTube 1-call/20m budget)

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
  cover_image = excluded.cover_image,
  twitch_game_id = excluded.twitch_game_id,
  youtube_query = excluded.youtube_query,
  is_active = true;

update public.games
set is_active = false
where slug not in (
  'bgmi', 'free-fire', 'valorant', 'gta-v', 'minecraft',
  'roblox', 'cs2', 'dota-2', 'fortnite', 'call-of-duty'
);
