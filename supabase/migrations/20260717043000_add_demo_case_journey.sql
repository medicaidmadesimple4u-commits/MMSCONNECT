begin;

create table if not exists public.demo_case_journeys (
  application_id uuid primary key references public.applications(id) on delete cascade,
  status text not null default 'active' check (status in ('active', 'attention', 'completed')),
  current_workflow_id text check (current_workflow_id is null or current_workflow_id ~ '^WF-(0[1-9]|1[0-4])$'),
  next_action text check (next_action is null or char_length(next_action) <= 300),
  exception_summary text check (exception_summary is null or char_length(exception_summary) <= 500),
  created_by uuid not null references public.profiles(id),
  environment text not null default 'staging' check (environment = 'staging'),
  test_mode boolean not null default true check (test_mode),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz
);

create table if not exists public.demo_case_workflow_steps (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.demo_case_journeys(application_id) on delete cascade,
  workflow_id text not null check (workflow_id ~ '^WF-(0[1-9]|1[0-4])$'),
  workflow_order smallint not null check (workflow_order between 1 and 14),
  step_order smallint not null check (step_order between 1 and 20),
  global_order smallint not null check (global_order between 1 and 200),
  actor_label text not null check (char_length(actor_label) between 2 and 120),
  action_label text not null check (char_length(action_label) between 4 and 500),
  next_owner_label text not null check (char_length(next_owner_label) between 2 and 120),
  output_summary text not null check (char_length(output_summary) between 4 and 500),
  screen_state text not null check (char_length(screen_state) between 2 and 160),
  status text not null default 'pending' check (status in ('pending', 'in_progress', 'blocked', 'completed', 'skipped')),
  due_at timestamptz,
  completed_by uuid references public.profiles(id),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (application_id, workflow_id, step_order),
  unique (application_id, global_order)
);

create table if not exists public.demo_case_artifacts (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.demo_case_journeys(application_id) on delete cascade,
  workflow_id text not null check (workflow_id ~ '^WF-(0[1-9]|1[0-4])$'),
  label text not null check (char_length(label) between 3 and 180),
  status text not null default 'pending' check (status in ('pending', 'in_progress', 'attention', 'complete')),
  details jsonb not null default '{}'::jsonb check (jsonb_typeof(details) = 'object'),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (application_id, workflow_id)
);

create table if not exists public.demo_case_journey_events (
  id bigint generated always as identity primary key,
  application_id uuid not null references public.demo_case_journeys(application_id) on delete cascade,
  workflow_id text check (workflow_id is null or workflow_id ~ '^WF-(0[1-9]|1[0-4])$'),
  actor_id uuid references public.profiles(id),
  event_type text not null check (char_length(event_type) between 3 and 80),
  summary text not null check (char_length(summary) between 3 and 1000),
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now()
);

create index if not exists demo_case_steps_application_order_idx on public.demo_case_workflow_steps (application_id, global_order);
create index if not exists demo_case_events_application_created_idx on public.demo_case_journey_events (application_id, created_at desc);

create or replace function public.set_demo_case_updated_at()
returns trigger language plpgsql set search_path = public as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists set_demo_case_journeys_updated_at_before_update on public.demo_case_journeys;
create trigger set_demo_case_journeys_updated_at_before_update before update on public.demo_case_journeys
for each row execute procedure public.set_demo_case_updated_at();

drop trigger if exists set_demo_case_steps_updated_at_before_update on public.demo_case_workflow_steps;
create trigger set_demo_case_steps_updated_at_before_update before update on public.demo_case_workflow_steps
for each row execute procedure public.set_demo_case_updated_at();

drop trigger if exists set_demo_case_artifacts_updated_at_before_update on public.demo_case_artifacts;
create trigger set_demo_case_artifacts_updated_at_before_update before update on public.demo_case_artifacts
for each row execute procedure public.set_demo_case_updated_at();

alter table public.demo_case_journeys enable row level security;
alter table public.demo_case_workflow_steps enable row level security;
alter table public.demo_case_artifacts enable row level security;
alter table public.demo_case_journey_events enable row level security;

revoke all on table public.demo_case_journeys from anon, authenticated;
revoke all on table public.demo_case_workflow_steps from anon, authenticated;
revoke all on table public.demo_case_artifacts from anon, authenticated;
revoke all on table public.demo_case_journey_events from anon, authenticated;
revoke all on sequence public.demo_case_journey_events_id_seq from anon, authenticated;

commit;
