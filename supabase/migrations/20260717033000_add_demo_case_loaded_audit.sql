begin;

alter table public.application_audit_log drop constraint if exists application_audit_log_action_check;
alter table public.application_audit_log add constraint application_audit_log_action_check check (action in (
  'application_created', 'applicant_saved', 'status_changed', 'assignment_changed',
  'residency_saved', 'household_member_saved', 'household_member_removed',
  'income_source_saved', 'income_source_removed', 'resource_saved', 'resource_removed',
  'living_arrangement_saved', 'health_coverage_saved', 'health_coverage_removed',
  'authorized_representative_saved', 'referral_needs_saved', 'application_submitted',
  'review_status_changed', 'application_reset', 'demo_case_loaded'
));

commit;
