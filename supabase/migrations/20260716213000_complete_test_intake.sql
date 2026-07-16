begin;

alter table public.application_audit_log drop constraint if exists application_audit_log_action_check;
alter table public.application_audit_log add constraint application_audit_log_action_check check (action in (
  'application_created', 'applicant_saved', 'status_changed', 'assignment_changed',
  'residency_saved', 'household_member_saved', 'household_member_removed',
  'income_source_saved', 'income_source_removed', 'resource_saved', 'resource_removed',
  'living_arrangement_saved', 'health_coverage_saved', 'health_coverage_removed',
  'authorized_representative_saved', 'application_submitted', 'review_status_changed'
));

create table if not exists public.application_resources (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.applications(id) on delete cascade,
  resource_type text not null check (resource_type in (
    'none', 'checking', 'savings', 'cash', 'real_property', 'vehicle', 'trust',
    'life_insurance', 'annuity', 'retirement_account', 'burial_asset', 'able_account', 'other'
  )),
  owner_label text check (owner_label is null or char_length(owner_label) <= 120),
  description text check (description is null or char_length(description) <= 200),
  current_value numeric(14,2) not null default 0 check (current_value >= 0),
  jointly_owned boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (resource_type <> 'none' or current_value = 0)
);

create table if not exists public.application_living_arrangements (
  application_id uuid primary key references public.applications(id) on delete cascade,
  setting text not null check (setting in (
    'own_home', 'rent_home', 'family_home', 'nursing_facility', 'hospital',
    'adult_care_home', 'assisted_living', 'group_home', 'without_fixed_address', 'other'
  )),
  facility_name text check (facility_name is null or char_length(facility_name) <= 180),
  facility_county text check (facility_county is null or char_length(facility_county) <= 80),
  admission_date date,
  spouse_at_home boolean not null default false,
  spouse_name text check (spouse_name is null or char_length(spouse_name) <= 160),
  intends_to_return_home boolean not null default false,
  level_of_care_status text not null default 'not_requested' check (level_of_care_status in ('not_requested', 'pending', 'approved', 'unknown')),
  fl2_status text not null default 'not_applicable' check (fl2_status in ('not_applicable', 'not_available', 'pending', 'available')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.application_health_coverage (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.applications(id) on delete cascade,
  coverage_type text not null check (coverage_type in (
    'none', 'employer', 'medicare_a', 'medicare_b', 'medicare_d', 'medicare_advantage',
    'medicaid', 'va', 'tricare', 'marketplace', 'private', 'other'
  )),
  covered_person text check (covered_person is null or char_length(covered_person) <= 160),
  insurer_name text check (insurer_name is null or char_length(insurer_name) <= 180),
  policyholder_name text check (policyholder_name is null or char_length(policyholder_name) <= 160),
  employment_coverage_available boolean not null default false,
  coverage_start_date date,
  coverage_end_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.application_authorized_representatives (
  application_id uuid primary key references public.applications(id) on delete cascade,
  wants_representative boolean not null default false,
  representative_type text not null default 'none' check (representative_type in ('none', 'person', 'organization')),
  representative_name text check (representative_name is null or char_length(representative_name) <= 160),
  organization_name text check (organization_name is null or char_length(organization_name) <= 180),
  relationship text check (relationship is null or char_length(relationship) <= 100),
  phone text check (phone is null or char_length(phone) <= 30),
  email text check (email is null or char_length(email) <= 254),
  authority_scope text not null default 'application_only' check (authority_scope in ('application_only', 'notices_and_application', 'full_case')),
  designation_acknowledged boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((not wants_representative and representative_type = 'none') or (wants_representative and representative_type <> 'none'))
);

create index if not exists resources_application_idx on public.application_resources (application_id, created_at);
create index if not exists health_coverage_application_idx on public.application_health_coverage (application_id, created_at);

create or replace function public.audit_completed_test_intake_child()
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
  target_application_id := case when tg_op = 'DELETE' then old.application_id else new.application_id end;
  target_entity_id := case
    when tg_table_name in ('application_living_arrangements', 'application_authorized_representatives') then target_application_id
    when tg_op = 'DELETE' then old.id else new.id
  end;
  audit_action := case
    when tg_table_name = 'application_resources' and tg_op = 'DELETE' then 'resource_removed'
    when tg_table_name = 'application_resources' then 'resource_saved'
    when tg_table_name = 'application_living_arrangements' then 'living_arrangement_saved'
    when tg_table_name = 'application_health_coverage' and tg_op = 'DELETE' then 'health_coverage_removed'
    when tg_table_name = 'application_health_coverage' then 'health_coverage_saved'
    else 'authorized_representative_saved'
  end;
  update public.applications set updated_at = now() where id = target_application_id;
  insert into public.application_audit_log (application_id, actor_id, action, entity_id)
  values (target_application_id, auth.uid(), audit_action, target_entity_id);
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

drop trigger if exists on_resource_updated on public.application_resources;
create trigger on_resource_updated before update on public.application_resources for each row execute procedure public.set_child_record_updated_at();
drop trigger if exists on_living_arrangement_updated on public.application_living_arrangements;
create trigger on_living_arrangement_updated before update on public.application_living_arrangements for each row execute procedure public.set_child_record_updated_at();
drop trigger if exists on_health_coverage_updated on public.application_health_coverage;
create trigger on_health_coverage_updated before update on public.application_health_coverage for each row execute procedure public.set_child_record_updated_at();
drop trigger if exists on_authorized_representative_updated on public.application_authorized_representatives;
create trigger on_authorized_representative_updated before update on public.application_authorized_representatives for each row execute procedure public.set_child_record_updated_at();

drop trigger if exists on_resource_audit on public.application_resources;
create trigger on_resource_audit after insert or update or delete on public.application_resources for each row execute procedure public.audit_completed_test_intake_child();
drop trigger if exists on_living_arrangement_audit on public.application_living_arrangements;
create trigger on_living_arrangement_audit after insert or update on public.application_living_arrangements for each row execute procedure public.audit_completed_test_intake_child();
drop trigger if exists on_health_coverage_audit on public.application_health_coverage;
create trigger on_health_coverage_audit after insert or update or delete on public.application_health_coverage for each row execute procedure public.audit_completed_test_intake_child();
drop trigger if exists on_authorized_representative_audit on public.application_authorized_representatives;
create trigger on_authorized_representative_audit after insert or update on public.application_authorized_representatives for each row execute procedure public.audit_completed_test_intake_child();

alter table public.application_resources enable row level security;
alter table public.application_living_arrangements enable row level security;
alter table public.application_health_coverage enable row level security;
alter table public.application_authorized_representatives enable row level security;

revoke all on public.application_resources from anon, authenticated;
revoke all on public.application_living_arrangements from anon, authenticated;
revoke all on public.application_health_coverage from anon, authenticated;
revoke all on public.application_authorized_representatives from anon, authenticated;

commit;
