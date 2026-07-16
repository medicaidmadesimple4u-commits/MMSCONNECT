begin;

alter table public.referrals
  add column if not exists source_application_id uuid references public.applications(id) on delete set null;

alter table public.referrals drop constraint if exists referrals_service_requested_check;
alter table public.referrals add constraint referrals_service_requested_check check (service_requested in (
  'medicaid_navigation', 'living_legacy', 'long_term_care', 'home_care', 'adult_day',
  'hospice_palliative', 'benefits_documents', 'community_resource', 'housing',
  'food_nutrition', 'transportation', 'utilities', 'legal_aid', 'behavioral_health',
  'caregiver_respite', 'other'
));

create index if not exists referrals_source_application_idx
  on public.referrals (source_application_id, updated_at desc)
  where source_application_id is not null;

create table if not exists public.application_referral_needs (
  application_id uuid primary key references public.applications(id) on delete cascade,
  help_needed boolean not null,
  requested_services text[] not null default '{}',
  urgency text not null default 'routine' check (urgency in ('routine', 'priority', 'time_sensitive')),
  preferred_contact_method text not null default 'portal' check (preferred_contact_method in ('portal', 'phone', 'text', 'email')),
  notes text check (notes is null or char_length(notes) <= 1000),
  referral_consent boolean not null default false,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (requested_services <@ array[
    'living_legacy', 'long_term_care', 'home_care', 'adult_day', 'hospice_palliative',
    'benefits_documents', 'community_resource', 'housing', 'food_nutrition',
    'transportation', 'utilities', 'legal_aid', 'behavioral_health', 'caregiver_respite', 'other'
  ]::text[]),
  check ((help_needed and cardinality(requested_services) > 0) or (not help_needed and cardinality(requested_services) = 0)),
  check (not referral_consent or help_needed)
);

create or replace function public.set_application_referral_needs_updated_at()
returns trigger language plpgsql set search_path = public as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists set_application_referral_needs_updated_at_before_update on public.application_referral_needs;
create trigger set_application_referral_needs_updated_at_before_update
before update on public.application_referral_needs
for each row execute procedure public.set_application_referral_needs_updated_at();

alter table public.application_audit_log drop constraint if exists application_audit_log_action_check;
alter table public.application_audit_log add constraint application_audit_log_action_check check (action in (
  'application_created', 'applicant_saved', 'status_changed', 'assignment_changed',
  'residency_saved', 'household_member_saved', 'household_member_removed',
  'income_source_saved', 'income_source_removed', 'resource_saved', 'resource_removed',
  'living_arrangement_saved', 'health_coverage_saved', 'health_coverage_removed',
  'authorized_representative_saved', 'referral_needs_saved', 'application_submitted',
  'review_status_changed', 'application_reset'
));

alter table public.application_referral_needs enable row level security;
revoke all on table public.application_referral_needs from anon, authenticated;

commit;
