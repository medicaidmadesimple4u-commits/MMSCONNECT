begin;

create table if not exists public.applications (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  program_id text not null check (program_id in (
    'expansion_adult', 'infants_children', 'pregnancy', 'caretaker',
    'former_foster', 'family_planning', 'breast_cervical',
    'aged_blind_disabled', 'medicare_savings', 'working_disabled',
    'long_term_care', 'cap', 'pace', 'innovations', 'tbi',
    'special_assistance_facility', 'special_assistance_in_home'
  )),
  status text not null default 'draft'
    check (status in ('draft', 'submitted', 'under_review', 'information_requested', 'approved', 'denied', 'withdrawn', 'closed')),
  policy_version text not null default '2026.1' check (char_length(policy_version) between 1 and 20),
  environment text not null default 'staging' check (environment = 'staging'),
  test_mode boolean not null default true check (test_mode = true),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.application_applicants (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.applications(id) on delete cascade,
  person_order smallint not null default 1 check (person_order between 1 and 30),
  legal_first_name text not null check (char_length(legal_first_name) between 1 and 80),
  legal_middle_name text check (legal_middle_name is null or char_length(legal_middle_name) <= 80),
  legal_last_name text not null check (char_length(legal_last_name) between 1 and 80),
  preferred_name text check (preferred_name is null or char_length(preferred_name) <= 80),
  date_of_birth date not null check (date_of_birth <= current_date),
  contact_email text check (contact_email is null or char_length(contact_email) <= 254),
  phone text check (phone is null or char_length(phone) <= 30),
  preferred_language text not null default 'English' check (char_length(preferred_language) between 1 and 80),
  nc_county text check (nc_county is null or char_length(nc_county) <= 80),
  applying_for_coverage boolean not null default true,
  created_by uuid not null default auth.uid() references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (application_id, person_order)
);

create table if not exists public.application_assignments (
  application_id uuid not null references public.applications(id) on delete cascade,
  staff_id uuid not null references auth.users(id) on delete cascade,
  assigned_by uuid references auth.users(id) on delete set null,
  assigned_at timestamptz not null default now(),
  active boolean not null default true,
  primary key (application_id, staff_id)
);

create table if not exists public.application_audit_log (
  id bigint generated always as identity primary key,
  application_id uuid not null references public.applications(id) on delete cascade,
  actor_id uuid references auth.users(id) on delete set null,
  action text not null check (action in ('application_created', 'applicant_saved', 'status_changed', 'assignment_changed')),
  entity_id uuid,
  created_at timestamptz not null default now()
);

create index if not exists applications_owner_created_idx on public.applications (owner_id, created_at desc);
create index if not exists applications_status_created_idx on public.applications (status, created_at desc);
create index if not exists application_applicants_application_idx on public.application_applicants (application_id);
create index if not exists application_assignments_staff_idx on public.application_assignments (staff_id) where active;
create index if not exists application_audit_application_idx on public.application_audit_log (application_id, created_at desc);

create or replace function public.is_active_privileged_user()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid())
      and account_type in ('staff', 'administrator')
      and status = 'active'
  );
$$;

create or replace function public.is_active_administrator()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid())
      and account_type = 'administrator'
      and status = 'active'
  );
$$;

create or replace function public.can_access_application(target_application_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.applications application
    where application.id = target_application_id
      and (
        application.owner_id = (select auth.uid())
        or public.is_active_administrator()
        or exists (
          select 1 from public.application_assignments assignment
          where assignment.application_id = application.id
            and assignment.staff_id = (select auth.uid())
            and assignment.active
        )
      )
  );
$$;

create or replace function public.can_edit_test_application(target_application_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.applications application
    where application.id = target_application_id
      and application.owner_id = (select auth.uid())
      and application.status = 'draft'
      and application.environment = 'staging'
      and application.test_mode
      and public.is_active_privileged_user()
  );
$$;

revoke all on function public.is_active_privileged_user() from public;
revoke all on function public.is_active_administrator() from public;
revoke all on function public.can_access_application(uuid) from public;
revoke all on function public.can_edit_test_application(uuid) from public;
grant execute on function public.is_active_privileged_user() to authenticated;
grant execute on function public.is_active_administrator() to authenticated;
grant execute on function public.can_access_application(uuid) to authenticated;
grant execute on function public.can_edit_test_application(uuid) to authenticated;

create or replace function public.set_intake_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create or replace function public.audit_application_created()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.application_audit_log (application_id, actor_id, action, entity_id)
  values (new.id, auth.uid(), 'application_created', new.id);
  return new;
end;
$$;

create or replace function public.audit_applicant_saved()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.application_audit_log (application_id, actor_id, action, entity_id)
  values (new.application_id, auth.uid(), 'applicant_saved', new.id);
  return new;
end;
$$;

drop trigger if exists on_application_updated on public.applications;
create trigger on_application_updated before update on public.applications
for each row execute procedure public.set_intake_updated_at();

drop trigger if exists on_application_applicant_updated on public.application_applicants;
create trigger on_application_applicant_updated before update on public.application_applicants
for each row execute procedure public.set_intake_updated_at();

drop trigger if exists on_application_created_audit on public.applications;
create trigger on_application_created_audit after insert on public.applications
for each row execute procedure public.audit_application_created();

drop trigger if exists on_application_applicant_saved_audit on public.application_applicants;
create trigger on_application_applicant_saved_audit after insert or update on public.application_applicants
for each row execute procedure public.audit_applicant_saved();

alter table public.applications enable row level security;
alter table public.application_applicants enable row level security;
alter table public.application_assignments enable row level security;
alter table public.application_audit_log enable row level security;

create policy "Authorized users can read applications"
  on public.applications for select to authenticated
  using (public.can_access_application(id));

create policy "Privileged users can create owned test applications"
  on public.applications for insert to authenticated
  with check (
    owner_id = (select auth.uid())
    and status = 'draft'
    and environment = 'staging'
    and test_mode
    and public.is_active_privileged_user()
  );

create policy "Authorized users can read applicant information"
  on public.application_applicants for select to authenticated
  using (public.can_access_application(application_id));

create policy "Privileged owners can add test applicant information"
  on public.application_applicants for insert to authenticated
  with check (
    created_by = (select auth.uid())
    and public.can_edit_test_application(application_id)
  );

create policy "Privileged owners can update test applicant information"
  on public.application_applicants for update to authenticated
  using (public.can_edit_test_application(application_id))
  with check (
    created_by = (select auth.uid())
    and public.can_edit_test_application(application_id)
  );

create policy "Staff can read their assignments"
  on public.application_assignments for select to authenticated
  using (staff_id = (select auth.uid()) or public.is_active_administrator());

create policy "Authorized users can read application audit history"
  on public.application_audit_log for select to authenticated
  using (public.can_access_application(application_id));

revoke all on public.applications from anon, authenticated;
revoke all on public.application_applicants from anon, authenticated;
revoke all on public.application_assignments from anon, authenticated;
revoke all on public.application_audit_log from anon, authenticated;
grant select, insert on public.applications to authenticated;
grant select, insert, update on public.application_applicants to authenticated;
grant select on public.application_assignments to authenticated;
grant select on public.application_audit_log to authenticated;

commit;
