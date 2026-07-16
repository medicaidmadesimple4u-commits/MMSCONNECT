begin;

create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 160),
  organization_type text not null check (organization_type in ('agency', 'facility', 'mms')),
  status text not null default 'pending' check (status in ('pending', 'active', 'suspended')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists organizations_normalized_name_idx
  on public.organizations (lower(trim(name)));

insert into public.organizations (id, name, organization_type, status)
values ('00000000-0000-4000-8000-000000000001', 'Medicaid Made Simple', 'mms', 'active')
on conflict (id) do update set name = excluded.name, organization_type = excluded.organization_type, status = 'active';

alter table public.profiles
  add column if not exists organization_id uuid references public.organizations(id);

insert into public.organizations (name, organization_type, status)
select
  min(trim(organization_name)),
  case when bool_or(account_type = 'facility') then 'facility' else 'agency' end,
  case when bool_or(status = 'active') then 'active' else 'pending' end
from public.profiles
where account_type in ('agency', 'facility') and nullif(trim(organization_name), '') is not null
group by lower(trim(organization_name))
on conflict do nothing;

update public.profiles profile
set organization_id = organization.id
from public.organizations organization
where profile.account_type in ('agency', 'facility')
  and lower(trim(profile.organization_name)) = lower(trim(organization.name));

update public.profiles
set organization_id = '00000000-0000-4000-8000-000000000001'
where account_type in ('staff', 'administrator');

create or replace function public.assign_profile_organization()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  directory_id uuid;
begin
  if new.account_type in ('staff', 'administrator') then
    new.organization_id := '00000000-0000-4000-8000-000000000001';
  elsif new.account_type in ('agency', 'facility') and nullif(trim(new.organization_name), '') is not null then
    select id into directory_id
    from public.organizations
    where lower(trim(name)) = lower(trim(new.organization_name))
    limit 1;

    if directory_id is null then
      insert into public.organizations (name, organization_type, status)
      values (trim(new.organization_name), new.account_type, case when new.status = 'active' then 'active' else 'pending' end)
      returning id into directory_id;
    elsif new.status = 'active' then
      update public.organizations set status = 'active', updated_at = now() where id = directory_id;
    end if;

    new.organization_id := directory_id;
  else
    new.organization_id := null;
  end if;
  return new;
end;
$$;

drop trigger if exists assign_profile_organization_before_save on public.profiles;
create trigger assign_profile_organization_before_save
before insert or update of account_type, organization_name, status on public.profiles
for each row execute procedure public.assign_profile_organization();

create table if not exists public.referrals (
  id uuid primary key default gen_random_uuid(),
  reference_number text not null unique check (char_length(reference_number) between 8 and 40),
  sender_organization_id uuid not null references public.organizations(id),
  recipient_organization_id uuid not null references public.organizations(id),
  created_by uuid not null references public.profiles(id),
  client_label text not null check (char_length(client_label) between 2 and 120),
  service_requested text not null check (service_requested in ('medicaid_navigation', 'living_legacy', 'long_term_care', 'home_care', 'adult_day', 'hospice_palliative', 'benefits_documents', 'community_resource', 'other')),
  urgency text not null default 'routine' check (urgency in ('routine', 'priority', 'time_sensitive')),
  summary text not null check (char_length(summary) between 10 and 1000),
  status text not null default 'sent' check (status in ('sent', 'acknowledged', 'accepted', 'declined', 'in_progress', 'completed', 'closed', 'cancelled')),
  consent_confirmed_at timestamptz not null,
  environment text not null default 'staging' check (environment in ('staging', 'production')),
  test_mode boolean not null default true,
  acknowledged_at timestamptz,
  accepted_at timestamptz,
  completed_at timestamptz,
  closed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (sender_organization_id <> recipient_organization_id),
  check ((environment = 'staging' and test_mode) or (environment = 'production' and not test_mode))
);

create table if not exists public.referral_events (
  id bigint generated always as identity primary key,
  referral_id uuid not null references public.referrals(id) on delete cascade,
  actor_id uuid not null references public.profiles(id),
  event_type text not null check (char_length(event_type) between 2 and 80),
  previous_status text,
  new_status text,
  note text check (note is null or char_length(note) <= 1000),
  created_at timestamptz not null default now()
);

create index if not exists referrals_sender_updated_idx on public.referrals (sender_organization_id, updated_at desc);
create index if not exists referrals_recipient_updated_idx on public.referrals (recipient_organization_id, updated_at desc);
create index if not exists referrals_status_updated_idx on public.referrals (status, updated_at desc);
create index if not exists referral_events_referral_created_idx on public.referral_events (referral_id, created_at asc);

create or replace function public.set_referral_updated_at()
returns trigger language plpgsql set search_path = public as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists set_referral_updated_at_before_update on public.referrals;
create trigger set_referral_updated_at_before_update
before update on public.referrals
for each row execute procedure public.set_referral_updated_at();

alter table public.organizations enable row level security;
alter table public.referrals enable row level security;
alter table public.referral_events enable row level security;

revoke all on table public.organizations from anon, authenticated;
revoke all on table public.referrals from anon, authenticated;
revoke all on table public.referral_events from anon, authenticated;
revoke all on sequence public.referral_events_id_seq from anon, authenticated;

commit;
