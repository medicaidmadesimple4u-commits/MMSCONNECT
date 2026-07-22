import { randomBytes } from 'node:crypto';
import { clientCaseWorkflows, totalDemoSteps } from '../../demo-case-workflows.js';
import { requestBody, requireAllowedOrigin, requireMethod, requirePrivilegedUser, safeError, sendJson, serviceRequest } from '../../lib/admin.js';

const mmsOrganizationId = '00000000-0000-4000-8000-000000000001';
const demoRecipientOrganizationId = '10000000-0000-4000-8000-000000000005';

function validUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function stagingEnabled() {
  return (process.env.VERCEL_TARGET_ENV || process.env.VERCEL_ENV || 'development') !== 'production';
}

function clientWorkflowById(id) {
  return clientCaseWorkflows.find(workflow => workflow.id === id) || null;
}

async function accessibleApplication(staff, applicationId) {
  const ownerFilter = staff.profile.account_type === 'administrator' ? '' : `&owner_id=eq.${encodeURIComponent(staff.user.id)}`;
  const rows = await serviceRequest(`/rest/v1/applications?select=id,owner_id,program_id,status,policy_version,environment,test_mode,created_at,updated_at&id=eq.${encodeURIComponent(applicationId)}${ownerFilter}&environment=eq.staging&test_mode=eq.true&limit=1`);
  return rows?.[0] || null;
}

async function addEvent(applicationId, staff, eventType, summary, workflowId = null, metadata = {}) {
  await serviceRequest('/rest/v1/demo_case_journey_events', { method: 'POST', prefer: 'return=minimal', body: {
    application_id: applicationId, workflow_id: workflowId, actor_id: staff.user.id, event_type: eventType, summary, metadata
  } });
}

function flattenedStepRows(applicationId) {
  let globalOrder = 0;
  return clientCaseWorkflows.flatMap((workflow, workflowIndex) => workflow.steps.map((item, stepIndex) => {
    globalOrder += 1;
    return {
      application_id: applicationId, workflow_id: workflow.id, workflow_order: workflowIndex + 1, step_order: stepIndex + 1, global_order: globalOrder,
      actor_label: item.actor, action_label: item.action, next_owner_label: item.owner, output_summary: item.output, screen_state: item.screen,
      status: globalOrder === 1 ? 'in_progress' : 'pending', due_at: new Date(Date.now() + Math.ceil(globalOrder / 4) * 86400000).toISOString()
    };
  }));
}

async function initializeJourney(application, staff) {
  let journeys = await serviceRequest(`/rest/v1/demo_case_journeys?select=*&application_id=eq.${encodeURIComponent(application.id)}&limit=1`);
  if (!journeys?.length) {
    await serviceRequest('/rest/v1/demo_case_journeys', { method: 'POST', prefer: 'return=minimal', body: {
      application_id: application.id, status: 'active', current_workflow_id: clientCaseWorkflows[0].id, next_action: clientCaseWorkflows[0].steps[0].action,
      created_by: staff.user.id, environment: 'staging', test_mode: true
    } });
    await serviceRequest('/rest/v1/demo_case_workflow_steps', { method: 'POST', prefer: 'return=minimal', body: flattenedStepRows(application.id) });
    await serviceRequest('/rest/v1/demo_case_artifacts', { method: 'POST', prefer: 'return=minimal', body: clientCaseWorkflows.map((workflow, index) => ({
      application_id: application.id, workflow_id: workflow.id, label: workflow.artifact, status: index === 0 ? 'in_progress' : 'pending',
      details: { summary: workflow.summary, statuses: workflow.statuses, exception: workflow.exception }
    })) });
    await addEvent(application.id, staff, 'journey_initialized', `Complete ${clientCaseWorkflows.length}-workflow fictional client case journey created with ${totalDemoSteps(clientCaseWorkflows)} accountable steps.`);
    journeys = await serviceRequest(`/rest/v1/demo_case_journeys?select=*&application_id=eq.${encodeURIComponent(application.id)}&limit=1`);
  }
  return journeys[0];
}

async function loadWorkspace(application) {
  const id = encodeURIComponent(application.id);
  const [journeys, steps, artifacts, events, applicants, applications] = await Promise.all([
    serviceRequest(`/rest/v1/demo_case_journeys?select=*&application_id=eq.${id}&limit=1`),
    serviceRequest(`/rest/v1/demo_case_workflow_steps?select=*&application_id=eq.${id}&order=global_order.asc`),
    serviceRequest(`/rest/v1/demo_case_artifacts?select=*&application_id=eq.${id}&order=workflow_id.asc`),
    serviceRequest(`/rest/v1/demo_case_journey_events?select=*&application_id=eq.${id}&order=created_at.desc,id.desc&limit=100`),
    serviceRequest(`/rest/v1/application_applicants?select=legal_first_name,legal_last_name&application_id=eq.${id}&person_order=eq.1&limit=1`),
    serviceRequest(`/rest/v1/applications?select=id,owner_id,program_id,status,policy_version,environment,test_mode,created_at,updated_at&id=eq.${id}&limit=1`)
  ]);
  const journey = journeys?.[0] || null;
  const completedSteps = (steps || []).filter(item => item.status === 'completed' || item.status === 'skipped').length;
  const completedWorkflows = clientCaseWorkflows.filter(workflow => {
    const workflowSteps = (steps || []).filter(item => item.workflow_id === workflow.id);
    return workflowSteps.length > 0 && workflowSteps.every(item => item.status === 'completed' || item.status === 'skipped');
  }).length;
  return {
    application: applications?.[0] || application, applicant_name: applicants?.[0] ? `${applicants[0].legal_first_name} ${applicants[0].legal_last_name}` : 'Fictional applicant',
    journey, steps: steps || [], artifacts: artifacts || [], events: events || [],
    progress: { completedSteps, totalSteps: (steps || []).length, completedWorkflows, totalWorkflows: clientCaseWorkflows.length }
  };
}

async function refreshProgress(application, staff) {
  const id = encodeURIComponent(application.id);
  const [steps, journeys] = await Promise.all([
    serviceRequest(`/rest/v1/demo_case_workflow_steps?select=*&application_id=eq.${id}&order=global_order.asc`),
    serviceRequest(`/rest/v1/demo_case_journeys?select=*&application_id=eq.${id}&limit=1`)
  ]);
  const firstOpen = (steps || []).find(item => item.status !== 'completed' && item.status !== 'skipped');
  const journey = journeys?.[0];
  const status = journey?.exception_summary ? 'attention' : firstOpen ? 'active' : 'completed';
  await serviceRequest(`/rest/v1/demo_case_journeys?application_id=eq.${id}`, { method: 'PATCH', prefer: 'return=minimal', body: {
    status, current_workflow_id: firstOpen?.workflow_id || null, next_action: firstOpen?.action_label || null,
    completed_at: status === 'completed' ? new Date().toISOString() : null
  } });
  if (firstOpen?.status === 'pending') {
    await serviceRequest(`/rest/v1/demo_case_workflow_steps?id=eq.${encodeURIComponent(firstOpen.id)}`, { method: 'PATCH', prefer: 'return=minimal', body: { status: 'in_progress' } });
    await serviceRequest(`/rest/v1/demo_case_artifacts?application_id=eq.${id}&workflow_id=eq.${encodeURIComponent(firstOpen.workflow_id)}&status=eq.pending`, { method: 'PATCH', prefer: 'return=minimal', body: { status: 'in_progress' } });
  }
  return loadWorkspace(application);
}

async function ensureCompletedCommunityReferral(application, staff) {
  const existing = await serviceRequest(`/rest/v1/referrals?select=id&source_application_id=eq.${encodeURIComponent(application.id)}&recipient_organization_id=eq.${demoRecipientOrganizationId}&service_requested=eq.living_legacy&environment=eq.staging&test_mode=eq.true&limit=1`);
  if (existing?.length) return existing[0].id;
  const now = new Date();
  const referenceNumber = `MMS-R-${now.toISOString().slice(2, 10).replaceAll('-', '')}-${randomBytes(3).toString('hex').toUpperCase()}`;
  const created = await serviceRequest('/rest/v1/referrals', { method: 'POST', prefer: 'return=representation', body: {
    reference_number: referenceNumber, sender_organization_id: mmsOrganizationId, recipient_organization_id: demoRecipientOrganizationId,
    created_by: staff.user.id, source_application_id: application.id, client_label: 'Fiona Quirk', service_requested: 'living_legacy', urgency: 'priority',
    summary: 'Fictional closed-loop referral for legacy planning and benefits-document support.', status: 'completed', consent_confirmed_at: now.toISOString(),
    environment: 'staging', test_mode: true, acknowledged_at: now.toISOString(), accepted_at: now.toISOString(), completed_at: now.toISOString()
  } });
  const referralId = created?.[0]?.id;
  const states = [
    ['referral_sent', null, 'sent', mmsOrganizationId, 'MMS sent the minimum-necessary fictional referral.'],
    ['demo_recipient_status_changed', 'sent', 'acknowledged', demoRecipientOrganizationId, 'Paperwork Wizards acknowledged the fictional referral.'],
    ['demo_recipient_status_changed', 'acknowledged', 'accepted', demoRecipientOrganizationId, 'Paperwork Wizards accepted the fictional referral.'],
    ['demo_recipient_status_changed', 'accepted', 'in_progress', demoRecipientOrganizationId, 'The fictional legacy-planning appointment began.'],
    ['demo_recipient_status_changed', 'in_progress', 'completed', demoRecipientOrganizationId, 'Paperwork Wizards confirmed the fictional service outcome.']
  ];
  await serviceRequest('/rest/v1/referral_events', { method: 'POST', prefer: 'return=minimal', body: states.map(([eventType, previousStatus, newStatus, actingOrganizationId, note]) => ({
    referral_id: referralId, actor_id: staff.user.id, acting_organization_id: actingOrganizationId, event_type: eventType, previous_status: previousStatus, new_status: newStatus, note
  })) });
  return referralId;
}

async function requireCurrentWorkflow(application, workflowId) {
  const workspace = await loadWorkspace(application);
  if (!clientWorkflowById(workflowId)) {
    const error = new Error('Select a valid fictional workflow.'); error.status = 400; throw error;
  }
  if (workspace.journey?.current_workflow_id !== workflowId) {
    const error = new Error(`Complete ${workspace.journey?.current_workflow_id || 'the active workflow'} before advancing ${workflowId}.`); error.status = 409; throw error;
  }
  return workspace;
}

export default async function handler(request, response) {
  if (!requireMethod(request, response, ['GET', 'POST'])) return;
  if (!stagingEnabled()) return sendJson(response, 404, { error: 'The fictional case journey is available only in staging.' });
  if (request.method === 'POST' && !requireAllowedOrigin(request, response)) return;
  try {
    const staff = await requirePrivilegedUser(request);
    const body = request.method === 'POST' ? requestBody(request) : {};
    const applicationId = String(request.method === 'GET' ? request.query?.applicationId || '' : body.applicationId || '');
    if (!validUuid(applicationId)) return sendJson(response, 400, { error: 'Select a valid fictional application.' });
    const application = await accessibleApplication(staff, applicationId);
    if (!application) return sendJson(response, 404, { error: 'The fictional application was not found or is not accessible.' });

    if (request.method === 'GET') return sendJson(response, 200, await loadWorkspace(application));
    const action = String(body.action || '');
    if (action === 'initialize') {
      if (application.status === 'draft') return sendJson(response, 409, { error: 'Submit the complete fictional application before opening its full case journey.' });
      await initializeJourney(application, staff);
      return sendJson(response, 200, await refreshProgress(application, staff));
    }
    if (action === 'reset') {
      await serviceRequest(`/rest/v1/referrals?source_application_id=eq.${encodeURIComponent(application.id)}&environment=eq.staging&test_mode=eq.true`, { method: 'DELETE' });
      await serviceRequest(`/rest/v1/demo_case_journeys?application_id=eq.${encodeURIComponent(application.id)}`, { method: 'DELETE' });
      await serviceRequest(`/rest/v1/applications?id=eq.${encodeURIComponent(application.id)}`, { method: 'PATCH', prefer: 'return=minimal', body: { status: 'submitted' } });
      await initializeJourney({ ...application, status: 'submitted' }, staff);
      return sendJson(response, 200, await refreshProgress({ ...application, status: 'submitted' }, staff));
    }

    await initializeJourney(application, staff);
    const workflowId = String(body.workflowId || '');

    if (action === 'advance_step') {
      const workspace = await requireCurrentWorkflow(application, workflowId);
      if (workspace.journey.status === 'attention') return sendJson(response, 409, { error: 'Resolve the simulated exception before continuing.' });
      const stepItem = workspace.steps.find(item => item.workflow_id === workflowId && item.status !== 'completed' && item.status !== 'skipped');
      if (!stepItem) return sendJson(response, 409, { error: 'This fictional workflow is already complete.' });
      await serviceRequest(`/rest/v1/demo_case_workflow_steps?id=eq.${encodeURIComponent(stepItem.id)}`, { method: 'PATCH', prefer: 'return=minimal', body: { status: 'completed', completed_by: staff.user.id, completed_at: new Date().toISOString() } });
      await addEvent(application.id, staff, 'step_completed', `${stepItem.actor_label}: ${stepItem.action_label}`, workflowId, { output: stepItem.output_summary, screen: stepItem.screen_state });
      const remaining = workspace.steps.filter(item => item.workflow_id === workflowId && item.id !== stepItem.id && item.status !== 'completed' && item.status !== 'skipped');
      if (!remaining.length) {
        await serviceRequest(`/rest/v1/demo_case_artifacts?application_id=eq.${encodeURIComponent(application.id)}&workflow_id=eq.${encodeURIComponent(workflowId)}`, { method: 'PATCH', prefer: 'return=minimal', body: { status: 'complete', completed_at: new Date().toISOString() } });
        await addEvent(application.id, staff, 'workflow_completed', `${workflowId} ${clientWorkflowById(workflowId).title} completed.`, workflowId);
        if (workflowId === 'WF-11') await ensureCompletedCommunityReferral(application, staff);
        if (workflowId === 'WF-09') await serviceRequest(`/rest/v1/applications?id=eq.${encodeURIComponent(application.id)}`, { method: 'PATCH', prefer: 'return=minimal', body: { status: 'approved' } });
        if (workflowId === 'WF-14') await serviceRequest(`/rest/v1/applications?id=eq.${encodeURIComponent(application.id)}`, { method: 'PATCH', prefer: 'return=minimal', body: { status: 'closed' } });
      }
      return sendJson(response, 200, await refreshProgress(application, staff));
    }

    if (action === 'complete_workflow') {
      const workspace = await requireCurrentWorkflow(application, workflowId);
      if (workspace.journey.status === 'attention') return sendJson(response, 409, { error: 'Resolve the simulated exception before completing this workflow.' });
      await serviceRequest(`/rest/v1/demo_case_workflow_steps?application_id=eq.${encodeURIComponent(application.id)}&workflow_id=eq.${encodeURIComponent(workflowId)}&status=not.in.(completed,skipped)`, { method: 'PATCH', prefer: 'return=minimal', body: { status: 'completed', completed_by: staff.user.id, completed_at: new Date().toISOString() } });
      await serviceRequest(`/rest/v1/demo_case_artifacts?application_id=eq.${encodeURIComponent(application.id)}&workflow_id=eq.${encodeURIComponent(workflowId)}`, { method: 'PATCH', prefer: 'return=minimal', body: { status: 'complete', completed_at: new Date().toISOString() } });
      await addEvent(application.id, staff, 'workflow_completed', `${workflowId} ${clientWorkflowById(workflowId).title} completed through its full fictional happy path.`, workflowId);
      if (workflowId === 'WF-11') await ensureCompletedCommunityReferral(application, staff);
      if (workflowId === 'WF-09') await serviceRequest(`/rest/v1/applications?id=eq.${encodeURIComponent(application.id)}`, { method: 'PATCH', prefer: 'return=minimal', body: { status: 'approved' } });
      if (workflowId === 'WF-14') await serviceRequest(`/rest/v1/applications?id=eq.${encodeURIComponent(application.id)}`, { method: 'PATCH', prefer: 'return=minimal', body: { status: 'closed' } });
      return sendJson(response, 200, await refreshProgress(application, staff));
    }

    if (action === 'simulate_exception') {
      const workspace = await requireCurrentWorkflow(application, workflowId);
      if (workspace.journey.status === 'attention') return sendJson(response, 409, { error: 'A fictional exception is already open.' });
      const stepItem = workspace.steps.find(item => item.workflow_id === workflowId && item.status !== 'completed' && item.status !== 'skipped');
      const exception = clientWorkflowById(workflowId).exception;
      await serviceRequest(`/rest/v1/demo_case_workflow_steps?id=eq.${encodeURIComponent(stepItem.id)}`, { method: 'PATCH', prefer: 'return=minimal', body: { status: 'blocked' } });
      await serviceRequest(`/rest/v1/demo_case_journeys?application_id=eq.${encodeURIComponent(application.id)}`, { method: 'PATCH', prefer: 'return=minimal', body: { status: 'attention', exception_summary: exception, next_action: 'Resolve the fictional exception and document the safe next step.' } });
      await serviceRequest(`/rest/v1/demo_case_artifacts?application_id=eq.${encodeURIComponent(application.id)}&workflow_id=eq.${encodeURIComponent(workflowId)}`, { method: 'PATCH', prefer: 'return=minimal', body: { status: 'attention' } });
      await addEvent(application.id, staff, 'exception_opened', exception, workflowId, { blockedStep: stepItem.action_label });
      return sendJson(response, 200, await loadWorkspace(application));
    }

    if (action === 'resolve_exception') {
      const workspace = await loadWorkspace(application);
      if (workspace.journey?.current_workflow_id !== workflowId || workspace.journey?.status !== 'attention') return sendJson(response, 409, { error: 'There is no open exception for this workflow.' });
      const blocked = workspace.steps.find(item => item.workflow_id === workflowId && item.status === 'blocked');
      if (blocked) await serviceRequest(`/rest/v1/demo_case_workflow_steps?id=eq.${encodeURIComponent(blocked.id)}`, { method: 'PATCH', prefer: 'return=minimal', body: { status: 'in_progress' } });
      await serviceRequest(`/rest/v1/demo_case_journeys?application_id=eq.${encodeURIComponent(application.id)}`, { method: 'PATCH', prefer: 'return=minimal', body: { status: 'active', exception_summary: null, next_action: blocked?.action_label || null } });
      await serviceRequest(`/rest/v1/demo_case_artifacts?application_id=eq.${encodeURIComponent(application.id)}&workflow_id=eq.${encodeURIComponent(workflowId)}`, { method: 'PATCH', prefer: 'return=minimal', body: { status: 'in_progress' } });
      await addEvent(application.id, staff, 'exception_resolved', 'Fictional exception resolved with an accountable owner and safe next action.', workflowId);
      return sendJson(response, 200, await refreshProgress(application, staff));
    }

    if (action === 'complete_all') {
      await serviceRequest(`/rest/v1/demo_case_workflow_steps?application_id=eq.${encodeURIComponent(application.id)}`, { method: 'PATCH', prefer: 'return=minimal', body: { status: 'completed', completed_by: staff.user.id, completed_at: new Date().toISOString() } });
      await serviceRequest(`/rest/v1/demo_case_artifacts?application_id=eq.${encodeURIComponent(application.id)}`, { method: 'PATCH', prefer: 'return=minimal', body: { status: 'complete', completed_at: new Date().toISOString() } });
      await serviceRequest(`/rest/v1/demo_case_journeys?application_id=eq.${encodeURIComponent(application.id)}`, { method: 'PATCH', prefer: 'return=minimal', body: { exception_summary: null } });
      await ensureCompletedCommunityReferral(application, staff);
      await serviceRequest(`/rest/v1/applications?id=eq.${encodeURIComponent(application.id)}`, { method: 'PATCH', prefer: 'return=minimal', body: { status: 'closed' } });
      await addEvent(application.id, staff, 'journey_completed', 'All 13 fictional client-case workflows completed with attributable steps, artifacts, referral outcome, and closure evidence.');
      return sendJson(response, 200, await refreshProgress(application, staff));
    }

    return sendJson(response, 400, { error: 'Unsupported fictional journey action.' });
  } catch (error) {
    return safeError(response, error);
  }
}
