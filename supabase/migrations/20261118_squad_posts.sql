-- Squad Finder LFG posts (self-expire after 3 hours)

create table if not exists public.squad_posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  creator_name text not null default '',
  is_pro boolean not null default false,
  game text not null,
  mode text not null,
  mic_required boolean not null default true,
  in_game_id text not null,
  note text not null default '',
  expires_at timestamptz not null default (now() + interval '3 hours'),
  created_at timestamptz not null default now(),
  constraint squad_posts_note_len check (char_length(note) <= 120),
  constraint squad_posts_in_game_id_len check (char_length(in_game_id) >= 2 and char_length(in_game_id) <= 48),
  constraint squad_posts_game_len check (char_length(game) >= 2 and char_length(game) <= 40),
  constraint squad_posts_mode_len check (char_length(mode) >= 2 and char_length(mode) <= 40)
);

-- Note: cannot use now() in a partial-index predicate (not IMMUTABLE).
create index if not exists squad_posts_active_idx
  on public.squad_posts (expires_at asc, is_pro desc, created_at desc);

create index if not exists squad_posts_user_created_idx
  on public.squad_posts (user_id, created_at desc);

create index if not exists squad_posts_game_idx
  on public.squad_posts (game, expires_at desc);

alter table public.squad_posts enable row level security;

drop policy if exists "Anyone can read active squad posts" on public.squad_posts;
create policy "Anyone can read active squad posts"
  on public.squad_posts for select
  using (expires_at > now());

drop policy if exists "Users insert own squad posts" on public.squad_posts;
create policy "Users insert own squad posts"
  on public.squad_posts for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "Users delete own squad posts" on public.squad_posts;
create policy "Users delete own squad posts"
  on public.squad_posts for delete
  to authenticated
  using (auth.uid() = user_id);

grant select on public.squad_posts to anon, authenticated;
grant insert, delete on public.squad_posts to authenticated;
