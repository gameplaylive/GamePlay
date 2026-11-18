-- Creator Pro billing fields on profiles (Cashfree subscriptions)

alter table public.profiles
  add column if not exists payment_provider text not null default 'cashfree',
  add column if not exists cashfree_subscription_id text,
  add column if not exists pro_expires_at timestamptz;

-- Ensure subscription_tier constraint remains free|pro
do $$ begin
  alter table public.profiles drop constraint if exists profiles_subscription_tier_check;
exception when undefined_object then null;
end $$;

alter table public.profiles
  add constraint profiles_subscription_tier_check
  check (subscription_tier in ('free', 'pro'));

update public.profiles
set payment_provider = 'cashfree'
where payment_provider is null or payment_provider = '';

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
    new.payment_provider := old.payment_provider;
    new.cashfree_subscription_id := old.cashfree_subscription_id;
    new.pro_expires_at := old.pro_expires_at;
  end if;
  return new;
end;
$$;
