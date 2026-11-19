-- Launch: remove Creator Pro requirement from Go Live RLS (keep subscription_tier columns).

drop policy if exists "Users insert own ingest credentials" on public.creator_ingest_credentials;
create policy "Users insert own ingest credentials"
  on public.creator_ingest_credentials for insert
  to authenticated
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and coalesce(p.is_banned, false) = false
    )
  );

drop policy if exists "Pro users can insert own community streams" on public.community_live_streams;
create policy "Signed-in users can insert own community streams"
  on public.community_live_streams for insert
  to authenticated
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and coalesce(p.is_banned, false) = false
    )
  );
