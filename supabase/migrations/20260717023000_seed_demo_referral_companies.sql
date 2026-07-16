begin;

alter table public.organizations
  add column if not exists test_mode boolean not null default false,
  add column if not exists description text check (description is null or char_length(description) <= 300),
  add column if not exists service_categories text[] not null default '{}';

alter table public.organizations drop constraint if exists organizations_service_categories_check;
alter table public.organizations add constraint organizations_service_categories_check check (
  service_categories <@ array[
    'medicaid_navigation', 'living_legacy', 'long_term_care', 'home_care', 'adult_day',
    'hospice_palliative', 'benefits_documents', 'community_resource', 'housing',
    'food_nutrition', 'transportation', 'utilities', 'legal_aid', 'behavioral_health',
    'caregiver_respite', 'other'
  ]::text[]
);

insert into public.organizations (id, name, organization_type, status, test_mode, description, service_categories)
values
  ('10000000-0000-4000-8000-000000000001', 'Helpful Llama Community Services', 'agency', 'active', true, 'Fictional community organization for end-to-end staging demonstrations.', array['community_resource', 'housing', 'food_nutrition', 'utilities']),
  ('10000000-0000-4000-8000-000000000002', 'Golden Acorn Home Care', 'agency', 'active', true, 'Fictional home-care and caregiver-support provider for staging.', array['home_care', 'caregiver_respite', 'transportation']),
  ('10000000-0000-4000-8000-000000000003', 'Pineapple Place Adult Day Center', 'agency', 'active', true, 'Fictional adult day program for staging.', array['adult_day', 'transportation', 'caregiver_respite']),
  ('10000000-0000-4000-8000-000000000004', 'Gentle Dragonfly Hospice', 'agency', 'active', true, 'Fictional hospice and caregiver-support organization for staging.', array['hospice_palliative', 'caregiver_respite']),
  ('10000000-0000-4000-8000-000000000005', 'Paperwork Wizards Legal & Legacy Center', 'agency', 'active', true, 'Fictional legal, legacy-planning, and benefits-support organization for staging.', array['living_legacy', 'legal_aid', 'benefits_documents']),
  ('10000000-0000-4000-8000-000000000006', 'Bluebird Senior Living', 'facility', 'active', true, 'Fictional senior-living facility for staging.', array['long_term_care', 'community_resource'])
on conflict (id) do update set
  name = excluded.name,
  organization_type = excluded.organization_type,
  status = 'active',
  test_mode = true,
  description = excluded.description,
  service_categories = excluded.service_categories,
  updated_at = now();

alter table public.referral_events
  add column if not exists acting_organization_id uuid references public.organizations(id) on delete set null;

create index if not exists referral_events_acting_organization_idx
  on public.referral_events (acting_organization_id, created_at desc)
  where acting_organization_id is not null;

commit;
