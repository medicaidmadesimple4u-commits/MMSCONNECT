import { randomBytes } from 'node:crypto';
import { requestBody, requireAllowedOrigin, requireMethod, requireReferralUser, safeError, sendJson, serviceRequest } from '../lib/admin.js';

const privilegedRoles = new Set(['staff', 'administrator']);
const mmsOrganizationId = '00000000-0000-4000-8000-000000000001';
const services = new Set(['medicaid_navigation', 'living_legacy', 'long_term_care', 'home_care', 'adult_day', 'hospice_palliative', 'benefits_documents', 'community_resource', 'housing', 'food_nutrition', 'transportation', 'utilities', 'legal_aid', 'behavioral_health', 'caregiver_respite', 'other']);
const urgencies = new Set(['routine', 'priority', 'time_sensitive']);
const transitions = {
  sent: ['acknowledged', 'accepted', 'declined', 'cancelled'],
  acknowledged: ['accepted', 'declined', 'cancelled'],
  accepted: ['in_progress', 'declined', 'cancelled'],
  in_progress: ['completed', 'cancelled'],
  completed: ['closed'],
  declined: ['closed'],
  cancelled: ['closed'],
  closed: []
};

function text(value, maximum) { return String(value || '').trim().slice(0, maximum); }
function validUuid(value) { return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value); }
function targetEnvironment() { return process.env.VERCEL_TARGET_ENV || process.env.VERCEL_ENV || 'development'; }
function productionEnabled() { return targetEnvironment() !== 'production' || process.env.MMS_REFERRALS_ENABLED === 'true'; }
function referralEnvironment() { return targetEnvironment() === 'production' ? 'production' : 'staging'; }
function testMode() { return referralEnvironment() === 'staging'; }
function referralLiteMode() { return referralEnvironment() === 'production'; }
function isPrivileged(context) { return privilegedRoles.has(context.profile.account_type); }
function isAccessible(context, referral) {
  return isPrivileged(context) || referral.sender_organization_id === context.profile.organization_id || referral.recipient_organization_id === context.profile.organization_id;
}

function recipientStatusActions(referral) {
  const possible = transitions[referral.status] || [];
  return possible.filter(status => ['acknowledged', 'accepted', 'declined', 'in_progress', 'completed'].includes(status) || (status === 'closed' && referral.status === 'completed'));
}

function allowedStatusActions(context, referral) {
  const possible = transitions[referral.status] || [];
  if (isPrivileged(context)) return possible;
  const recipient = referral.recipient_organization_id === context.profile.organization_id;
  const sender = referral.sender_organization_id === context.profile.organization_id;
  return possible.filter(status => {
    if (recipient && recipientStatusActions(referral).includes(status)) return true;
    if (sender && status === 'cancelled') return true;
    if (sender && status === 'closed' && ['completed', 'declined', 'cancelled'].includes(referral.status)) return true;
    return false;
  });
}

async function listAccessibleReferrals(context) {
  const select = 'id,reference_number,sender_organization_id,recipient_organization_id,created_by,source_application_id,client_label,service_requested,urgency,summary,status,environment,test_mode,coordination_mode,acknowledged_at,accepted_at,completed_at,closed_at,created_at,updated_at';
  const scope = `&environment=eq.${referralEnvironment()}&test_mode=eq.${testMode()}`;
  if (isPrivileged(context)) return serviceRequest(`/rest/v1/referrals?select=${select}${scope}&order=updated_at.desc&limit=500`);
  const organizationId = encodeURIComponent(context.profile.organization_id);
  const [sent, received] = await Promise.all([
    serviceRequest(`/rest/v1/referrals?select=${select}&sender_organization_id=eq.${organizationId}${scope}&order=updated_at.desc&limit=250`),
    serviceRequest(`/rest/v1/referrals?select=${select}&recipient_organization_id=eq.${organizationId}${scope}&order=updated_at.desc&limit=250`)
  ]);
  const unique = new Map([...(sent || []), ...(received || [])].map(referral => [referral.id, referral]));
  return [...unique.values()].sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at));
}

async function referralById(id) {
  const rows = await serviceRequest(`/rest/v1/referrals?select=*&id=eq.${encodeURIComponent(id)}&environment=eq.${referralEnvironment()}&test_mode=eq.${testMode()}&limit=1`);
  return rows?.[0] || null;
}

async function directoryAndMap() {
  const organizations = await serviceRequest('/rest/v1/organizations?select=id,name,organization_type,status,test_mode,description,service_categories&order=name.asc');
  return { organizations: organizations || [], map: new Map((organizations || []).map(organization => [organization.id, organization])) };
}

async function eventHistory(referralId, organizations) {
  const events = await serviceRequest(`/rest/v1/referral_events?select=id,actor_id,acting_organization_id,event_type,previous_status,new_status,note,created_at&referral_id=eq.${encodeURIComponent(referralId)}&order=created_at.asc`);
  const actorIds = [...new Set((events || []).map(event => event.actor_id))];
  const profiles = actorIds.length ? await serviceRequest(`/rest/v1/profiles?select=id,first_name,last_name,organization_name&id=in.(${actorIds.join(',')})`) : [];
  const actors = new Map((profiles || []).map(profile => [profile.id, profile]));
  return (events || []).map(event => {
    const actor = actors.get(event.actor_id);
    return {
      ...event,
      note: referralLiteMode() ? null : event.note,
      actor_name: actor ? `${actor.first_name || ''} ${actor.last_name || ''}`.trim() || 'MMS Connect user' : 'MMS Connect user',
      actor_organization: organizations.get(event.acting_organization_id)?.name || actor?.organization_name || '',
      simulated: event.event_type === 'demo_recipient_status_changed' || event.event_type === 'demo_referral_sent'
    };
  });
}

function decorateReferral(context, referral, organizations) {
  const sender = organizations.get(referral.sender_organization_id);
  const recipient = organizations.get(referral.recipient_organization_id);
  const decorated = {
    ...referral,
    source_application_id: isPrivileged(context) ? referral.source_application_id || null : null,
    sender_organization: sender?.name || 'Unknown organization',
    recipient_organization: recipient?.name || 'Unknown organization',
    sender_is_test: Boolean(sender?.test_mode),
    recipient_is_test: Boolean(recipient?.test_mode),
    is_sender: referral.sender_organization_id === context.profile.organization_id,
    is_recipient: referral.recipient_organization_id === context.profile.organization_id,
    allowed_status_actions: allowedStatusActions(context, referral),
    recipient_simulation_actions: testMode() && isPrivileged(context) && recipient?.test_mode ? recipientStatusActions(referral) : []
  };
  if (referralLiteMode()) {
    delete decorated.client_label;
    delete decorated.summary;
    delete decorated.source_application_id;
    decorated.coordination_mode = 'referral_lite';
  }
  return decorated;
}

function timestampChanges(status) {
  const now = new Date().toISOString();
  if (status === 'acknowledged') return { acknowledged_at: now };
  if (status === 'accepted') return { accepted_at: now, acknowledged_at: now };
  if (status === 'completed') return { completed_at: now };
  if (status === 'closed') return { closed_at: now };
  return {};
}

export default async function handler(request, response) {
  if (!requireMethod(request, response, ['GET', 'POST'])) return;
  if (!productionEnabled()) return sendJson(response, 404, { error: 'The referral network is not available in production yet.' });
  if (request.method === 'POST' && !requireAllowedOrigin(request, response)) return;

  try {
    const context = await requireReferralUser(request);
    const { organizations, map: organizationMap } = await directoryAndMap();

    if (request.method === 'GET') {
      const referralId = String(request.query?.referralId || '').trim();
      if (referralId) {
        if (!validUuid(referralId)) return sendJson(response, 400, { error: 'Select a valid referral.' });
        const referral = await referralById(referralId);
        if (!referral || !isAccessible(context, referral)) return sendJson(response, 404, { error: 'The referral was not found.' });
        return sendJson(response, 200, {
          referralMode: referralLiteMode() ? 'referral_lite' : 'fictional_test',
          referral: decorateReferral(context, referral, organizationMap),
          events: await eventHistory(referral.id, organizationMap)
        });
      }
      const referrals = await listAccessibleReferrals(context);
      const activeDirectory = organizations.filter(organization => organization.status === 'active' && organization.id !== context.profile.organization_id && (testMode() || !organization.test_mode)).map(({ status, ...organization }) => organization);
      const demoOrganizations = testMode() && isPrivileged(context) ? organizations.filter(organization => organization.status === 'active' && organization.test_mode) : [];
      return sendJson(response, 200, {
        referralMode: referralLiteMode() ? 'referral_lite' : 'fictional_test',
        organization: organizationMap.get(context.profile.organization_id) || null,
        directory: activeDirectory,
        demoOrganizations,
        referrals: referrals.map(referral => decorateReferral(context, referral, organizationMap))
      });
    }

    const body = requestBody(request);
    const action = String(body.action || '');
    if (action === 'create' || action === 'create_demo_inbound') {
      const demoInbound = action === 'create_demo_inbound';
      const recipientOrganizationId = demoInbound ? mmsOrganizationId : String(body.recipientOrganizationId || '');
      const senderOrganizationId = demoInbound ? String(body.senderOrganizationId || '') : context.profile.organization_id;
      const serviceRequested = String(body.serviceRequested || '');
      const urgency = String(body.urgency || 'routine');
      const clientLabel = text(body.clientLabel, 120);
      const summary = text(body.summary, 1000);
      const staging = targetEnvironment() !== 'production';
      const requestedSourceApplicationId = demoInbound ? '' : String(body.sourceApplicationId || '');
      const senderOrganization = organizationMap.get(senderOrganizationId);
      const recipientOrganization = organizationMap.get(recipientOrganizationId);
      if (demoInbound && (!staging || !isPrivileged(context) || context.profile.organization_id !== mmsOrganizationId)) return sendJson(response, 403, { error: 'Only MMS staff can generate fictional inbound referrals in staging.' });
      if (!staging && (clientLabel || summary || requestedSourceApplicationId || text(body.note, 1000))) return sendJson(response, 400, {
        error: 'Referral Lite does not accept client names, case labels, summaries, notes, intake links, or other confidential information.'
      });
      if (demoInbound && (!validUuid(senderOrganizationId) || !senderOrganization?.test_mode || recipientOrganization?.id !== mmsOrganizationId)) return sendJson(response, 400, { error: 'Select a fictional staging organization.' });
      if (!senderOrganization || senderOrganization.status !== 'active') return sendJson(response, 403, { error: 'Your organization is not active in the referral directory.' });
      if (!validUuid(recipientOrganizationId) || !recipientOrganization || recipientOrganization.status !== 'active' || recipientOrganizationId === senderOrganization.id) return sendJson(response, 400, { error: 'Select another active organization or Medicaid Made Simple.' });
      if (!services.has(serviceRequested) || !urgencies.has(urgency)) return sendJson(response, 400, { error: 'Select a service and urgency.' });
      if (staging && (clientLabel.length < 2 || summary.length < 10)) return sendJson(response, 400, { error: 'Complete the fictional client label and referral summary.' });
      if (demoInbound && !senderOrganization.service_categories?.includes(serviceRequested)) return sendJson(response, 400, { error: 'Select a service offered by the fictional sending organization.' });
      if (recipientOrganization.test_mode && !recipientOrganization.service_categories?.includes(serviceRequested)) return sendJson(response, 400, { error: 'Select a service offered by the fictional recipient organization.' });
      if (body.consentConfirmed !== true) return sendJson(response, 400, { error: 'Confirm the client authorized this referral.' });
      if (staging && body.fictionalConfirmation !== true) return sendJson(response, 400, { error: 'Confirm that every referral detail is fictional test information.' });

      let sourceApplicationId = null;
      if (requestedSourceApplicationId) {
        if (!isPrivileged(context) || !validUuid(requestedSourceApplicationId)) return sendJson(response, 403, { error: 'Only MMS staff can create a referral from an intake record.' });
        const [applications, referralNeeds] = await Promise.all([
          serviceRequest(`/rest/v1/applications?select=id,owner_id,status&id=eq.${encodeURIComponent(requestedSourceApplicationId)}&environment=eq.staging&test_mode=eq.true&limit=1`),
          serviceRequest(`/rest/v1/application_referral_needs?select=application_id,help_needed,requested_services,referral_consent&application_id=eq.${encodeURIComponent(requestedSourceApplicationId)}&limit=1`)
        ]);
        const sourceApplication = applications?.[0];
        const need = referralNeeds?.[0];
        if (!sourceApplication || sourceApplication.status === 'draft' || (context.profile.account_type === 'staff' && sourceApplication.owner_id !== context.user.id)) return sendJson(response, 403, { error: 'You do not have access to create a referral from this submitted intake.' });
        if (!need?.help_needed || !need.referral_consent || !need.requested_services?.includes(serviceRequested)) return sendJson(response, 400, { error: 'This intake does not contain consent for the selected outbound referral need.' });
        sourceApplicationId = requestedSourceApplicationId;
      }

      const date = new Date().toISOString().slice(2, 10).replaceAll('-', '');
      const referenceNumber = `MMS-R-${date}-${randomBytes(3).toString('hex').toUpperCase()}`;
      const created = await serviceRequest('/rest/v1/referrals', { method: 'POST', prefer: 'return=representation', body: {
        reference_number: referenceNumber, sender_organization_id: senderOrganization.id, recipient_organization_id: recipientOrganization.id,
        source_application_id: staging ? sourceApplicationId : null, created_by: context.user.id,
        client_label: staging ? clientLabel : null, service_requested: serviceRequested, urgency, summary: staging ? summary : null, status: 'sent',
        consent_confirmed_at: new Date().toISOString(), environment: staging ? 'staging' : 'production', test_mode: staging,
        coordination_mode: staging ? 'standard' : 'referral_lite'
      } });
      const referral = created?.[0];
      await serviceRequest('/rest/v1/referral_events', { method: 'POST', prefer: 'return=minimal', body: {
        referral_id: referral.id, actor_id: context.user.id, acting_organization_id: senderOrganization.id,
        event_type: demoInbound ? 'demo_referral_sent' : 'referral_sent', previous_status: null, new_status: 'sent',
        note: staging ? (demoInbound ? `Fictional inbound referral generated for testing as ${senderOrganization.name}.` : 'Referral created and sent.') : null
      } });
      return sendJson(response, 201, { referral: decorateReferral(context, referral, organizationMap) });
    }

    const referralId = String(body.referralId || '');
    if (!validUuid(referralId)) return sendJson(response, 400, { error: 'Select a valid referral.' });
    const referral = await referralById(referralId);
    if (!referral || !isAccessible(context, referral)) return sendJson(response, 404, { error: 'The referral was not found.' });

    if (action === 'add_note') {
      if (referralLiteMode()) return sendJson(response, 403, { error: 'Referral Lite does not accept free-text updates or confidential information.' });
      const note = text(body.note, 1000);
      if (note.length < 2) return sendJson(response, 400, { error: 'Enter a referral update.' });
      await serviceRequest('/rest/v1/referral_events', { method: 'POST', prefer: 'return=minimal', body: { referral_id: referral.id, actor_id: context.user.id, acting_organization_id: context.profile.organization_id, event_type: 'note_added', previous_status: referral.status, new_status: referral.status, note } });
      return sendJson(response, 200, { updated: true });
    }

    if (action === 'simulate_recipient_status') {
      const nextStatus = String(body.status || '');
      const recipientOrganization = organizationMap.get(referral.recipient_organization_id);
      if (!testMode() || !isPrivileged(context) || !recipientOrganization?.test_mode) return sendJson(response, 403, { error: 'Recipient simulation is limited to fictional staging organizations.' });
      if (!recipientStatusActions(referral).includes(nextStatus)) return sendJson(response, 403, { error: 'That response is not available for the fictional recipient at this stage.' });
      const note = text(body.note, 1000) || `Simulated ${recipientOrganization.name} response.`;
      const updated = await serviceRequest(`/rest/v1/referrals?id=eq.${encodeURIComponent(referral.id)}`, { method: 'PATCH', prefer: 'return=representation', body: { status: nextStatus, ...timestampChanges(nextStatus) } });
      await serviceRequest('/rest/v1/referral_events', { method: 'POST', prefer: 'return=minimal', body: {
        referral_id: referral.id, actor_id: context.user.id, acting_organization_id: recipientOrganization.id,
        event_type: 'demo_recipient_status_changed', previous_status: referral.status, new_status: nextStatus, note
      } });
      return sendJson(response, 200, { referral: decorateReferral(context, updated?.[0], organizationMap) });
    }

    if (action === 'update_status') {
      const nextStatus = String(body.status || '');
      const allowed = allowedStatusActions(context, referral);
      if (!allowed.includes(nextStatus)) return sendJson(response, 403, { error: 'That status change is not available for your role or this referral.' });
      if (referralLiteMode() && text(body.note, 1000)) return sendJson(response, 400, { error: 'Referral Lite status changes cannot include notes.' });
      const note = referralLiteMode() ? null : text(body.note, 1000) || null;
      const updated = await serviceRequest(`/rest/v1/referrals?id=eq.${encodeURIComponent(referral.id)}`, { method: 'PATCH', prefer: 'return=representation', body: { status: nextStatus, ...timestampChanges(nextStatus) } });
      await serviceRequest('/rest/v1/referral_events', { method: 'POST', prefer: 'return=minimal', body: { referral_id: referral.id, actor_id: context.user.id, acting_organization_id: context.profile.organization_id, event_type: 'status_changed', previous_status: referral.status, new_status: nextStatus, note } });
      return sendJson(response, 200, { referral: decorateReferral(context, updated?.[0], organizationMap) });
    }

    return sendJson(response, 400, { error: 'Unsupported referral action.' });
  } catch (error) {
    return safeError(response, error);
  }
}
