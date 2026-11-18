-- Platform admin bootstrap + privilege protection for Google Sign-In users

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  initial_role text := 'user';
begin
  if lower(coalesce(new.email, '')) = 'gameliveapp@gmail.com' then
    initial_role := 'admin';
  end if;

  insert into public.profiles (id, email, full_name, avatar_url, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', ''),
    coalesce(new.raw_user_meta_data->>'avatar_url', new.raw_user_meta_data->>'picture', ''),
    initial_role
  )
  on conflict (id) do update set
    email = excluded.email,
    full_name = coalesce(nullif(excluded.full_name, ''), profiles.full_name),
    avatar_url = coalesce(nullif(excluded.avatar_url, ''), profiles.avatar_url),
    role = case
      when lower(coalesce(excluded.email, '')) = 'gameliveapp@gmail.com' then 'admin'
      else profiles.role
    end,
    updated_at = now();
  return new;
end;
$$;

create or replace function public.protect_profile_privileges()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    return new;
  end if;
  if not public.is_admin() then
    new.role := old.role;
    new.subscription_tier := old.subscription_tier;
    new.is_banned := old.is_banned;
    new.stripe_customer_id := old.stripe_customer_id;
  end if;
  return new;
end;
$$;

drop trigger if exists protect_profile_privileges on public.profiles;
create trigger protect_profile_privileges
  before update on public.profiles
  for each row execute function public.protect_profile_privileges();

update public.profiles
set role = 'admin', updated_at = now()
where lower(email) = 'gameliveapp@gmail.com';
