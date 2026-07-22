begin;

delete from public.demo_case_workflow_steps
where workflow_id = 'WF-02';

delete from public.demo_case_artifacts
where workflow_id = 'WF-02';

update public.demo_case_journeys
set current_workflow_id = null,
    next_action = 'Reopen the fictional client case journey to continue with the next client workflow.',
    exception_summary = null,
    status = case when status = 'completed' then 'completed' else 'active' end
where current_workflow_id = 'WF-02';

insert into public.demo_case_journey_events (application_id, event_type, summary, metadata)
select application_id,
       'facility_workflow_separated',
       'Facility Excel bulk import was removed from the individual client case journey and reserved for facility accounts.',
       jsonb_build_object('workflow_id', 'WF-02', 'audience', 'facility')
from public.demo_case_journeys;

commit;
