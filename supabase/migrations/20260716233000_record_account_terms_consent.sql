begin;

create table if not exists public.account_consents (
  user_id uuid primary key references auth.users(id) on delete cascade,
  terms_version text not null check (char_length(terms_version) between 1 and 30),
  privacy_version text not null check (char_length(privacy_version) between 1 and 30),
  accepted_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create or replace function public.record_new_account_consent()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if coalesce(new.raw_user_meta_data ->> 'terms_accepted', 'false') = 'true' then
    insert into public.account_consents (user_id, terms_version, privacy_version, accepted_at)
    values (
      new.id,
      coalesce(nullif(new.raw_user_meta_data ->> 'terms_version', ''), 'unknown'),
      coalesce(nullif(new.raw_user_meta_data ->> 'privacy_version', ''), 'unknown'),
      now()
    )
    on conflict (user_id) do nothing;
  end if;
  return new;
end;
$$;

drop trigger if exists on_auth_user_account_consent on auth.users;
create trigger on_auth_user_account_consent
after insert on auth.users
for each row execute procedure public.record_new_account_consent();

alter table public.account_consents enable row level security;
create policy "Users can read their account consent"
on public.account_consents for select to authenticated
using (user_id = (select auth.uid()) or public.is_active_administrator());

revoke all on public.account_consents from anon, authenticated;
grant select on public.account_consents to authenticated;

commit;
