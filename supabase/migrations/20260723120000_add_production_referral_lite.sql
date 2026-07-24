begin;

alter table public.referrals
  add column if not exists coordination_mode text not null default 'standard';

alter table public.referrals alter column client_label drop not null;
alter table public.referrals alter column summary drop not null;

alter table public.referrals drop constraint if exists referrals_client_label_check;
alter table public.referrals drop constraint if exists referrals_summary_check;
alter table public.referrals drop constraint if exists referrals_coordination_mode_check;
alter table public.referrals drop constraint if exists referrals_environment_data_boundary_check;

alter table public.referrals
  add constraint referrals_client_label_check
  check (client_label is null or char_length(client_label) between 2 and 120);

alter table public.referrals
  add constraint referrals_summary_check
  check (summary is null or char_length(summary) between 10 and 1000);

alter table public.referrals
  add constraint referrals_coordination_mode_check
  check (coordination_mode in ('standard', 'referral_lite'));

update public.referral_events
set note = null
where referral_id in (
  select id from public.referrals where environment = 'production'
);

update public.referrals
set coordination_mode = 'referral_lite',
    client_label = null,
    summary = null,
    source_application_id = null
where environment = 'production';

alter table public.referrals
  add constraint referrals_environment_data_boundary_check
  check (
    (
      environment = 'staging'
      and test_mode
      and coordination_mode = 'standard'
      and client_label is not null
      and summary is not null
    )
    or
    (
      environment = 'production'
      and not test_mode
      and coordination_mode = 'referral_lite'
      and client_label is null
      and summary is null
      and source_application_id is null
    )
  );

create or replace function public.enforce_referral_lite_event_boundary()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if new.note is not null and exists (
    select 1
    from public.referrals
    where id = new.referral_id
      and coordination_mode = 'referral_lite'
  ) then
    raise exception 'Referral Lite events cannot contain free-text notes';
  end if;
  return new;
end;
$$;

drop trigger if exists enforce_referral_lite_event_boundary_before_write on public.referral_events;
create trigger enforce_referral_lite_event_boundary_before_write
before insert or update of note, referral_id on public.referral_events
for each row execute procedure public.enforce_referral_lite_event_boundary();

commit;
