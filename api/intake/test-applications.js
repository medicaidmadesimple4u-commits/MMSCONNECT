import { getProgram, policyRelease } from '../../intake-policy.js';
import { requestBody, requireAllowedOrigin, requireMethod, requirePrivilegedUser, safeError, sendJson, serviceRequest } from '../../lib/admin.js';

function text(value, maximum) {
  return String(value || '').trim().slice(0, maximum);
}

function optionalText(value, maximum) {
  return text(value, maximum) || null;
}

function validDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T12:00:00Z`);
  return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value && date <= new Date();
}

function validOptionalEmail(value) {
  return !value || (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) && value.length <= 254);
}

async function ownedTestApplication(userId, applicationId) {
  const applications = await serviceRequest(`/rest/v1/applications?select=id,owner_id,program_id,status,policy_version,environment,test_mode,created_at,updated_at&id=eq.${encodeURIComponent(applicationId)}&owner_id=eq.${encodeURIComponent(userId)}&environment=eq.staging&test_mode=eq.true&limit=1`);
  return applications?.[0] || null;
}

export default async function handler(request, response) {
  if (!requireMethod(request, response, ['GET', 'POST'])) return;
  if (request.method === 'POST' && !requireAllowedOrigin(request, response)) return;

  try {
    const staff = await requirePrivilegedUser(request);
    if (request.method === 'GET') {
      const applicationId = String(request.query?.applicationId || '').trim();
      if (applicationId) {
        const application = await ownedTestApplication(staff.user.id, applicationId);
        if (!application) return sendJson(response, 404, { error: 'The fictional test application was not found.' });
        const applicants = await serviceRequest(`/rest/v1/application_applicants?select=legal_first_name,legal_middle_name,legal_last_name,preferred_name,date_of_birth,contact_email,phone,preferred_language,nc_county,applying_for_coverage&application_id=eq.${encodeURIComponent(application.id)}&person_order=eq.1&limit=1`);
        return sendJson(response, 200, { application, applicant: applicants?.[0] || null });
      }

      const applications = await serviceRequest(`/rest/v1/applications?select=id,program_id,status,policy_version,created_at,updated_at&owner_id=eq.${encodeURIComponent(staff.user.id)}&environment=eq.staging&test_mode=eq.true&order=updated_at.desc`);
      return sendJson(response, 200, { applications: applications || [] });
    }

    const body = requestBody(request);
    const action = String(body.action || '');
    if (action === 'create') {
      const program = getProgram(String(body.programId || ''));
      if (!program) return sendJson(response, 400, { error: 'Select a valid NCDHHS intake pathway.' });
      const created = await serviceRequest('/rest/v1/applications', {
        method: 'POST',
        prefer: 'return=representation',
        body: { owner_id: staff.user.id, program_id: program.id, status: 'draft', policy_version: policyRelease.version, environment: 'staging', test_mode: true }
      });
      return sendJson(response, 201, { application: created?.[0] });
    }

    if (action === 'save_applicant') {
      const applicationId = String(body.applicationId || '');
      const application = await ownedTestApplication(staff.user.id, applicationId);
      if (!application || application.status !== 'draft') return sendJson(response, 404, { error: 'The editable fictional test application was not found.' });
      if (body.fictionalConfirmation !== true) return sendJson(response, 400, { error: 'Confirm that every value is fictional test information.' });

      const legalFirstName = text(body.legalFirstName, 80);
      const legalLastName = text(body.legalLastName, 80);
      const dateOfBirth = String(body.dateOfBirth || '');
      const preferredLanguage = text(body.preferredLanguage || 'English', 80);
      const contactEmail = optionalText(body.contactEmail, 254);
      if (!legalFirstName || !legalLastName || !preferredLanguage || !validDate(dateOfBirth)) return sendJson(response, 400, { error: 'Complete the required fictional applicant fields.' });
      if (!validOptionalEmail(contactEmail)) return sendJson(response, 400, { error: 'Enter a valid fictional email address or leave it blank.' });

      const saved = await serviceRequest('/rest/v1/application_applicants?on_conflict=application_id%2Cperson_order', {
        method: 'POST',
        prefer: 'resolution=merge-duplicates,return=representation',
        body: {
          application_id: application.id,
          person_order: 1,
          legal_first_name: legalFirstName,
          legal_middle_name: optionalText(body.legalMiddleName, 80),
          legal_last_name: legalLastName,
          preferred_name: optionalText(body.preferredName, 80),
          date_of_birth: dateOfBirth,
          contact_email: contactEmail,
          phone: optionalText(body.phone, 30),
          preferred_language: preferredLanguage,
          nc_county: optionalText(body.ncCounty, 80),
          applying_for_coverage: body.applyingForCoverage !== false,
          created_by: staff.user.id
        }
      });
      return sendJson(response, 200, { applicant: saved?.[0] });
    }

    return sendJson(response, 400, { error: 'Unsupported intake action.' });
  } catch (error) {
    return safeError(response, error);
  }
}
