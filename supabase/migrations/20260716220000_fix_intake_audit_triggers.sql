begin;

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
  if tg_op = 'DELETE' then
    target_application_id := old.application_id;
  else
    target_application_id := new.application_id;
  end if;

  if tg_table_name = 'application_living_arrangements' then
    target_entity_id := target_application_id;
    audit_action := 'living_arrangement_saved';
  elsif tg_table_name = 'application_authorized_representatives' then
    target_entity_id := target_application_id;
    audit_action := 'authorized_representative_saved';
  elsif tg_table_name = 'application_resources' then
    if tg_op = 'DELETE' then target_entity_id := old.id; else target_entity_id := new.id; end if;
    if tg_op = 'DELETE' then audit_action := 'resource_removed'; else audit_action := 'resource_saved'; end if;
  elsif tg_table_name = 'application_health_coverage' then
    if tg_op = 'DELETE' then target_entity_id := old.id; else target_entity_id := new.id; end if;
    if tg_op = 'DELETE' then audit_action := 'health_coverage_removed'; else audit_action := 'health_coverage_saved'; end if;
  else
    raise exception 'Unsupported intake audit table: %', tg_table_name;
  end if;

  update public.applications set updated_at = now() where id = target_application_id;
  insert into public.application_audit_log (application_id, actor_id, action, entity_id)
  values (target_application_id, auth.uid(), audit_action, target_entity_id);
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

commit;
