-- MMS Connect authentication foundation
-- Run this once in the Supabase SQL Editor before enabling public registration.
-- This schema stores account identity only. It must not store PHI or Medicaid case data.

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  first_name text not null check (char_length(first_name) between 1 and 80),
  last_name text not null check (char_length(last_name) between 1 and 80),
  organization_name text check (organization_name is null or char_length(organization_name) between 2 and 160),
  account_type text not null default 'client'
    check (account_type in ('client', 'authorized_representative', 'agency', 'facility', 'staff', 'administrator')),
  status text not null default 'active'
    check (status in ('pending', 'active', 'suspended', 'closed')),
  phone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles
  add column if not exists organization_name text
  check (organization_name is null or char_length(organization_name) between 2 and 160);

alter table public.profiles drop constraint if exists profiles_account_type_check;
alter table public.profiles
  add constraint profiles_account_type_check
  check (account_type in ('client', 'authorized_representative', 'agency', 'facility', 'staff', 'administrator'));

alter table public.profiles enable row level security;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
declare
  requested_type text;
begin
  requested_type := new.raw_user_meta_data ->> 'account_type';
  if requested_type is null or requested_type not in ('client', 'authorized_representative', 'agency', 'facility') then
    requested_type := 'client';
  end if;

  insert into public.profiles (id, first_name, last_name, organization_name, account_type, status)
  values (
    new.id,
    left(coalesce(nullif(trim(new.raw_user_meta_data ->> 'first_name'), ''), 'MMS'), 80),
    left(coalesce(nullif(trim(new.raw_user_meta_data ->> 'last_name'), ''), 'Connect User'), 80),
    case
      when requested_type in ('agency', 'facility')
        then left(nullif(trim(new.raw_user_meta_data ->> 'organization_name'), ''), 160)
      else null
    end,
    requested_type,
    case when requested_type in ('agency', 'facility') then 'pending' else 'active' end
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

create or replace function public.set_profile_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

drop trigger if exists on_profile_updated on public.profiles;
create trigger on_profile_updated
  before update on public.profiles
  for each row execute procedure public.set_profile_updated_at();

drop policy if exists "Users can read their own profile" on public.profiles;
create policy "Users can read their own profile"
  on public.profiles
  for select
  to authenticated
  using ((select auth.uid()) = id);

drop policy if exists "Users can update allowed fields on their own profile" on public.profiles;
create policy "Users can update allowed fields on their own profile"
  on public.profiles
  for update
  to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

revoke all on table public.profiles from anon;
revoke insert, delete on table public.profiles from authenticated;
revoke update on table public.profiles from authenticated;
grant select on table public.profiles to authenticated;
grant update (first_name, last_name, organization_name, phone) on table public.profiles to authenticated;

-- Staff and administrator access must be changed only by a trusted server-side
-- administrative workflow. Agency and facility accounts may self-register only
-- with pending status and must be verified before organization features are enabled.
-- Account type and status remain protected from browser updates. Never expose
-- the service-role key in browser code or Vercel client variables.
