import { randomBytes } from 'node:crypto';
import { requestBody, requireAllowedOrigin, requireMethod, requireReferralUser, safeError, sendJson, serviceRequest } from '../lib/admin.js';

const privilegedRoles = new Set(['staff', 'administrator']);
const services = new Set(['medicaid_navigation', 'living_legacy', 'long_term_care', 'home_care', 'adult_day', 'hospice_palliative', 'benefits_documents', 'community_resource', 'other']);
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
function isPrivileged(context) { return privilegedRoles.has(context.profile.account_type); }
function isAccessible(context, referral) {
  return isPrivileged(context) || referral.sender_organization_id === context.profile.organization_id || referral.recipient_organization_id === context.profile.organization_id;
}

function allowedStatusActions(context, referral) {
  const possible = transitions[referral.status] || [];
  if (isPrivileged(context)) return possible;
  const recipient = referral.recipient_organization_id === context.profile.organization_id;
  const sender = referral.sender_organization_id === context.profile.organization_id;
  return possible.filter(status => {
    if (recipient && ['acknowledged', 'accepted', 'declined', 'in_progress', 'completed'].includes(status)) return true;
    if (recipient && status === 'closed' && referral.status === 'completed') return true;
    if (sender && status === 'cancelled') return true;
    if (sender && status === 'closed' && ['completed', 'declined', 'cancelled'].includes(referral.status)) return true;
    return false;
  });
}

async function listAccessibleReferrals(context) {
  const select = 'id,reference_number,sender_organization_id,recipient_organization_id,created_by,client_label,service_requested,urgency,summary,status,environment,test_mode,acknowledged_at,accepted_at,completed_at,closed_at,created_at,updated_at';
  if (isPrivileged(context)) return serviceRequest(`/rest/v1/referrals?select=${select}&order=updated_at.desc&limit=500`);
  const organizationId = encodeURIComponent(context.profile.organization_id);
  const [sent, received] = await Promise.all([
    serviceRequest(`/rest/v1/referrals?select=${select}&sender_organization_id=eq.${organizationId}&order=updated_at.desc&limit=250`),
    serviceRequest(`/rest/v1/referrals?select=${select}&recipient_organization_id=eq.${organizationId}&order=updated_at.desc&limit=250`)
  ]);
  const unique = new Map([...(sent || []), ...(received || [])].map(referral => [referral.id, referral]));
  return [...unique.values()].sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at));
}

async function referralById(id) {
  const rows = await serviceRequest(`/rest/v1/referrals?select=*&id=eq.${encodeURIComponent(id)}&limit=1`);
  return rows?.[0] || null;
}

async function directoryAndMap() {
  const organizations = await serviceRequest('/rest/v1/organizations?select=id,name,organization_type,status&order=name.asc');
  return { organizations: organizations || [], map: new Map((organizations || []).map(organization => [organization.id, organization])) };
}

async function eventHistory(referralId) {
  const events = await serviceRequest(`/rest/v1/referral_events?select=id,actor_id,event_type,previous_status,new_status,note,created_at&referral_id=eq.${encodeURIComponent(referralId)}&order=created_at.asc`);
  const actorIds = [...new Set((events || []).map(event => event.actor_id))];
  const profiles = actorIds.length ? await serviceRequest(`/rest/v1/profiles?select=id,first_name,last_name,organization_name&id=in.(${actorIds.join(',')})`) : [];
  const actors = new Map((profiles || []).map(profile => [profile.id, profile]));
  return (events || []).map(event => {
    const actor = actors.get(event.actor_id);
    return {
      ...event,
      actor_name: actor ? `${actor.first_name || ''} ${actor.last_name || ''}`.trim() || 'MMS Connect user' : 'MMS Connect user',
      actor_organization: actor?.organization_name || ''
    };
  });
}

function decorateReferral(context, referral, organizations) {
  return {
    ...referral,
    sender_organization: organizations.get(referral.sender_organization_id)?.name || 'Unknown organization',
    recipient_organization: organizations.get(referral.recipient_organization_id)?.name || 'Unknown organization',
    is_sender: referral.sender_organization_id === context.profile.organization_id,
    is_recipient: referral.recipient_organization_id === context.profile.organization_id,
    allowed_status_actions: allowedStatusActions(context, referral)
  };
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
        return sendJson(response, 200, { referral: decorateReferral(context, referral, organizationMap), events: await eventHistory(referral.id) });
      }
      const referrals = await listAccessibleReferrals(context);
      const activeDirectory = organizations.filter(organization => organization.status === 'active' && organization.id !== context.profile.organization_id).map(({ status, ...organization }) => organization);
      return sendJson(response, 200, {
        referralMode: targetEnvironment() === 'production' ? 'production' : 'fictional_test',
        organization: organizationMap.get(context.profile.organization_id) || null,
        directory: activeDirectory,
        referrals: referrals.map(referral => decorateReferral(context, referral, organizationMap))
      });
    }

    const body = requestBody(request);
    const action = String(body.action || '');
    if (action === 'create') {
      const recipientOrganizationId = String(body.recipientOrganizationId || '');
      const serviceRequested = String(body.serviceRequested || '');
      const urgency = String(body.urgency || 'routine');
      const clientLabel = text(body.clientLabel, 120);
      const summary = text(body.summary, 1000);
      const staging = targetEnvironment() !== 'production';
      const senderOrganization = organizationMap.get(context.profile.organization_id);
      const recipientOrganization = organizationMap.get(recipientOrganizationId);
      if (!senderOrganization || senderOrganization.status !== 'active') return sendJson(response, 403, { error: 'Your organization is not active in the referral directory.' });
      if (!validUuid(recipientOrganizationId) || !recipientOrganization || recipientOrganization.status !== 'active' || recipientOrganizationId === senderOrganization.id) return sendJson(response, 400, { error: 'Select another active organization or Medicaid Made Simple.' });
      if (!services.has(serviceRequested) || !urgencies.has(urgency) || clientLabel.length < 2 || summary.length < 10) return sendJson(response, 400, { error: 'Complete the client label, service, urgency, and referral summary.' });
      if (body.consentConfirmed !== true) return sendJson(response, 400, { error: 'Confirm the client authorized this referral.' });
      if (staging && body.fictionalConfirmation !== true) return sendJson(response, 400, { error: 'Confirm that every referral detail is fictional test information.' });

      const date = new Date().toISOString().slice(2, 10).replaceAll('-', '');
      const referenceNumber = `MMS-R-${date}-${randomBytes(3).toString('hex').toUpperCase()}`;
      const created = await serviceRequest('/rest/v1/referrals', { method: 'POST', prefer: 'return=representation', body: {
        reference_number: referenceNumber, sender_organization_id: senderOrganization.id, recipient_organization_id: recipientOrganization.id,
        created_by: context.user.id, client_label: clientLabel, service_requested: serviceRequested, urgency, summary, status: 'sent',
        consent_confirmed_at: new Date().toISOString(), environment: staging ? 'staging' : 'production', test_mode: staging
      } });
      const referral = created?.[0];
      await serviceRequest('/rest/v1/referral_events', { method: 'POST', prefer: 'return=minimal', body: { referral_id: referral.id, actor_id: context.user.id, event_type: 'referral_sent', previous_status: null, new_status: 'sent', note: 'Referral created and sent.' } });
      return sendJson(response, 201, { referral: decorateReferral(context, referral, organizationMap) });
    }

    const referralId = String(body.referralId || '');
    if (!validUuid(referralId)) return sendJson(response, 400, { error: 'Select a valid referral.' });
    const referral = await referralById(referralId);
    if (!referral || !isAccessible(context, referral)) return sendJson(response, 404, { error: 'The referral was not found.' });

    if (action === 'add_note') {
      const note = text(body.note, 1000);
      if (note.length < 2) return sendJson(response, 400, { error: 'Enter a referral update.' });
      await serviceRequest('/rest/v1/referral_events', { method: 'POST', prefer: 'return=minimal', body: { referral_id: referral.id, actor_id: context.user.id, event_type: 'note_added', previous_status: referral.status, new_status: referral.status, note } });
      return sendJson(response, 200, { updated: true });
    }

    if (action === 'update_status') {
      const nextStatus = String(body.status || '');
      const allowed = allowedStatusActions(context, referral);
      if (!allowed.includes(nextStatus)) return sendJson(response, 403, { error: 'That status change is not available for your role or this referral.' });
      const note = text(body.note, 1000) || null;
      const updated = await serviceRequest(`/rest/v1/referrals?id=eq.${encodeURIComponent(referral.id)}`, { method: 'PATCH', prefer: 'return=representation', body: { status: nextStatus, ...timestampChanges(nextStatus) } });
      await serviceRequest('/rest/v1/referral_events', { method: 'POST', prefer: 'return=minimal', body: { referral_id: referral.id, actor_id: context.user.id, event_type: 'status_changed', previous_status: referral.status, new_status: nextStatus, note } });
      return sendJson(response, 200, { referral: decorateReferral(context, updated?.[0], organizationMap) });
    }

    return sendJson(response, 400, { error: 'Unsupported referral action.' });
  } catch (error) {
    return safeError(response, error);
  }
}
