begin;

alter table public.profiles
  add column if not exists organization_name text
  check (organization_name is null or char_length(organization_name) between 2 and 160);

alter table public.profiles drop constraint if exists profiles_account_type_check;
alter table public.profiles
  add constraint profiles_account_type_check
  check (account_type in ('client', 'authorized_representative', 'agency', 'facility', 'staff', 'administrator'));

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

grant update (organization_name) on table public.profiles to authenticated;

commit;
