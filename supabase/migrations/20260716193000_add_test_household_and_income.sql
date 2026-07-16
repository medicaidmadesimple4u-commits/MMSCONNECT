begin;

alter table public.application_audit_log drop constraint if exists application_audit_log_action_check;
alter table public.application_audit_log
  add constraint application_audit_log_action_check check (action in (
    'application_created', 'applicant_saved', 'status_changed', 'assignment_changed',
    'residency_saved', 'household_member_saved', 'household_member_removed',
    'income_source_saved', 'income_source_removed'
  ));

create table if not exists public.application_residency (
  application_id uuid primary key references public.applications(id) on delete cascade,
  lives_in_nc boolean not null default true,
  physical_address_line_1 text not null check (char_length(physical_address_line_1) between 1 and 160),
  physical_address_line_2 text check (physical_address_line_2 is null or char_length(physical_address_line_2) <= 160),
  physical_city text not null check (char_length(physical_city) between 1 and 100),
  physical_state text not null default 'NC' check (char_length(physical_state) = 2),
  physical_postal_code text not null check (char_length(physical_postal_code) between 5 and 10),
  nc_county text not null check (char_length(nc_county) between 1 and 80),
  mailing_same boolean not null default true,
  mailing_address_line_1 text check (mailing_address_line_1 is null or char_length(mailing_address_line_1) <= 160),
  mailing_address_line_2 text check (mailing_address_line_2 is null or char_length(mailing_address_line_2) <= 160),
  mailing_city text check (mailing_city is null or char_length(mailing_city) <= 100),
  mailing_state text check (mailing_state is null or char_length(mailing_state) = 2),
  mailing_postal_code text check (mailing_postal_code is null or char_length(mailing_postal_code) <= 10),
  temporarily_absent boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.application_household_members (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.applications(id) on delete cascade,
  first_name text not null check (char_length(first_name) between 1 and 80),
  last_name text not null check (char_length(last_name) between 1 and 80),
  date_of_birth date not null check (date_of_birth <= current_date),
  relationship_to_applicant text not null check (relationship_to_applicant in (
    'spouse', 'child', 'stepchild', 'parent', 'stepparent', 'sibling',
    'caretaker_relative', 'other_relative', 'unrelated', 'other'
  )),
  lives_with_applicant boolean not null default true,
  applying_for_coverage boolean not null default false,
  tax_relationship text not null default 'non_filer' check (tax_relationship in (
    'tax_filer', 'joint_filer', 'tax_dependent', 'non_filer', 'not_sure'
  )),
  pregnant boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.application_income_sources (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.applications(id) on delete cascade,
  household_member_id uuid references public.application_household_members(id) on delete cascade,
  source_type text not null check (source_type in (
    'employment', 'self_employment', 'social_security', 'ssi', 'unemployment',
    'pension_retirement', 'workers_compensation', 'veterans_benefits',
    'alimony', 'rental', 'interest_dividends', 'other', 'no_income'
  )),
  source_name text check (source_name is null or char_length(source_name) <= 160),
  gross_amount numeric(12,2) not null default 0 check (gross_amount >= 0),
  frequency text not null default 'monthly' check (frequency in (
    'hourly', 'weekly', 'every_two_weeks', 'twice_monthly', 'monthly', 'quarterly', 'annually', 'one_time'
  )),
  hours_per_week numeric(5,2) check (hours_per_week is null or (hours_per_week >= 0 and hours_per_week <= 168)),
  expected_to_change boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists household_members_application_idx on public.application_household_members (application_id, created_at);
create index if not exists income_sources_application_idx on public.application_income_sources (application_id, created_at);
create index if not exists income_sources_household_member_idx on public.application_income_sources (household_member_id) where household_member_id is not null;

create or replace function public.set_child_record_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create or replace function public.audit_test_intake_child()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_application_id uuid;
  target_entity_id uuid;
  audit_action text;
begin
  if tg_op = 'DELETE' then
    target_application_id := old.application_id;
  else
    target_application_id := new.application_id;
  end if;

  if tg_table_name = 'application_residency' then
    target_entity_id := target_application_id;
  elsif tg_op = 'DELETE' then
    target_entity_id := old.id;
  else
    target_entity_id := new.id;
  end if;
  audit_action := case
    when tg_table_name = 'application_residency' then 'residency_saved'
    when tg_table_name = 'application_household_members' and tg_op = 'DELETE' then 'household_member_removed'
    when tg_table_name = 'application_household_members' then 'household_member_saved'
    when tg_table_name = 'application_income_sources' and tg_op = 'DELETE' then 'income_source_removed'
    else 'income_source_saved'
  end;

  update public.applications set updated_at = now() where id = target_application_id;
  insert into public.application_audit_log (application_id, actor_id, action, entity_id)
  values (target_application_id, auth.uid(), audit_action, target_entity_id);
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

drop trigger if exists on_residency_updated on public.application_residency;
create trigger on_residency_updated before update on public.application_residency
for each row execute procedure public.set_child_record_updated_at();

drop trigger if exists on_household_member_updated on public.application_household_members;
create trigger on_household_member_updated before update on public.application_household_members
for each row execute procedure public.set_child_record_updated_at();

drop trigger if exists on_income_source_updated on public.application_income_sources;
create trigger on_income_source_updated before update on public.application_income_sources
for each row execute procedure public.set_child_record_updated_at();

drop trigger if exists on_residency_audit on public.application_residency;
create trigger on_residency_audit after insert or update on public.application_residency
for each row execute procedure public.audit_test_intake_child();

drop trigger if exists on_household_member_audit on public.application_household_members;
create trigger on_household_member_audit after insert or update or delete on public.application_household_members
for each row execute procedure public.audit_test_intake_child();

drop trigger if exists on_income_source_audit on public.application_income_sources;
create trigger on_income_source_audit after insert or update or delete on public.application_income_sources
for each row execute procedure public.audit_test_intake_child();

alter table public.application_residency enable row level security;
alter table public.application_household_members enable row level security;
alter table public.application_income_sources enable row level security;

revoke all on public.applications from anon, authenticated;
revoke all on public.application_applicants from anon, authenticated;
revoke all on public.application_assignments from anon, authenticated;
revoke all on public.application_audit_log from anon, authenticated;
revoke all on public.application_residency from anon, authenticated;
revoke all on public.application_household_members from anon, authenticated;
revoke all on public.application_income_sources from anon, authenticated;

commit;
