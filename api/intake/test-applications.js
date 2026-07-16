import { getProgram, getProgramSections, policyRelease } from '../../intake-policy.js';
import { requestBody, requireAllowedOrigin, requireMethod, requirePrivilegedUser, safeError, sendJson, serviceRequest } from '../../lib/admin.js';

const relationships = new Set(['spouse', 'child', 'stepchild', 'parent', 'stepparent', 'sibling', 'caretaker_relative', 'other_relative', 'unrelated', 'other']);
const taxRelationships = new Set(['tax_filer', 'joint_filer', 'tax_dependent', 'non_filer', 'not_sure']);
const incomeTypes = new Set(['employment', 'self_employment', 'social_security', 'ssi', 'unemployment', 'pension_retirement', 'workers_compensation', 'veterans_benefits', 'alimony', 'rental', 'interest_dividends', 'other', 'no_income']);
const incomeFrequencies = new Set(['hourly', 'weekly', 'every_two_weeks', 'twice_monthly', 'monthly', 'quarterly', 'annually', 'one_time']);
const resourceTypes = new Set(['none', 'checking', 'savings', 'cash', 'real_property', 'vehicle', 'trust', 'life_insurance', 'annuity', 'retirement_account', 'burial_asset', 'able_account', 'other']);
const livingSettings = new Set(['own_home', 'rent_home', 'family_home', 'nursing_facility', 'hospital', 'adult_care_home', 'assisted_living', 'group_home', 'without_fixed_address', 'other']);
const careStatuses = new Set(['not_requested', 'pending', 'approved', 'unknown']);
const fl2Statuses = new Set(['not_applicable', 'not_available', 'pending', 'available']);
const coverageTypes = new Set(['none', 'employer', 'medicare_a', 'medicare_b', 'medicare_d', 'medicare_advantage', 'medicaid', 'va', 'tricare', 'marketplace', 'private', 'other']);
const representativeTypes = new Set(['none', 'person', 'organization']);
const authorityScopes = new Set(['application_only', 'notices_and_application', 'full_case']);
const reviewStatuses = new Set(['under_review', 'information_requested', 'approved', 'denied', 'closed']);

function text(value, maximum) { return String(value || '').trim().slice(0, maximum); }
function optionalText(value, maximum) { return text(value, maximum) || null; }
function validUuid(value) { return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value); }
function confirmedFictional(body) { return body.fictionalConfirmation === true; }
function validOptionalEmail(value) { return !value || (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) && value.length <= 254); }
function validDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T12:00:00Z`);
  return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value && date <= new Date();
}
function validOptionalDate(value) { return !value || /^\d{4}-\d{2}-\d{2}$/.test(value); }

async function testApplication(applicationId, ownerId = '') {
  const ownerFilter = ownerId ? `&owner_id=eq.${encodeURIComponent(ownerId)}` : '';
  const rows = await serviceRequest(`/rest/v1/applications?select=id,owner_id,program_id,status,policy_version,environment,test_mode,created_at,updated_at&id=eq.${encodeURIComponent(applicationId)}${ownerFilter}&environment=eq.staging&test_mode=eq.true&limit=1`);
  return rows?.[0] || null;
}

async function accessibleApplication(staff, applicationId) {
  return testApplication(applicationId, staff.profile.account_type === 'administrator' ? '' : staff.user.id);
}

async function applicationDetails(application) {
  const id = encodeURIComponent(application.id);
  const [applicants, residencyRows, householdMembers, incomeSources, resources, livingRows, healthCoverage, representativeRows] = await Promise.all([
    serviceRequest(`/rest/v1/application_applicants?select=legal_first_name,legal_middle_name,legal_last_name,preferred_name,date_of_birth,contact_email,phone,preferred_language,nc_county,applying_for_coverage&application_id=eq.${id}&person_order=eq.1&limit=1`),
    serviceRequest(`/rest/v1/application_residency?select=*&application_id=eq.${id}&limit=1`),
    serviceRequest(`/rest/v1/application_household_members?select=id,first_name,last_name,date_of_birth,relationship_to_applicant,lives_with_applicant,applying_for_coverage,tax_relationship,pregnant,created_at&application_id=eq.${id}&order=created_at.asc`),
    serviceRequest(`/rest/v1/application_income_sources?select=id,household_member_id,source_type,source_name,gross_amount,frequency,hours_per_week,expected_to_change,created_at&application_id=eq.${id}&order=created_at.asc`),
    serviceRequest(`/rest/v1/application_resources?select=id,resource_type,owner_label,description,current_value,jointly_owned,created_at&application_id=eq.${id}&order=created_at.asc`),
    serviceRequest(`/rest/v1/application_living_arrangements?select=*&application_id=eq.${id}&limit=1`),
    serviceRequest(`/rest/v1/application_health_coverage?select=id,coverage_type,covered_person,insurer_name,policyholder_name,employment_coverage_available,coverage_start_date,coverage_end_date,created_at&application_id=eq.${id}&order=created_at.asc`),
    serviceRequest(`/rest/v1/application_authorized_representatives?select=*&application_id=eq.${id}&limit=1`)
  ]);
  const details = {
    application,
    applicant: applicants?.[0] || null,
    residency: residencyRows?.[0] || null,
    householdMembers: householdMembers || [], incomeSources: incomeSources || [], resources: resources || [],
    livingArrangement: livingRows?.[0] || null, healthCoverage: healthCoverage || [], authorizedRepresentative: representativeRows?.[0] || null
  };
  const resourceRequired = getProgramSections(application.program_id).some(section => section.id === 'resources');
  details.completion = {
    applicant: Boolean(details.applicant), residency: Boolean(details.residency), income: details.incomeSources.length > 0,
    resources: !resourceRequired || details.resources.length > 0, resourcesRequired: resourceRequired,
    livingArrangement: Boolean(details.livingArrangement), healthCoverage: details.healthCoverage.length > 0,
    authorizedRepresentative: Boolean(details.authorizedRepresentative)
  };
  details.completion.ready = Object.entries(details.completion).filter(([key]) => key !== 'resourcesRequired').every(([, value]) => value === true);
  return details;
}

async function auditStatus(applicationId, actorId, action) {
  await serviceRequest('/rest/v1/application_audit_log', { method: 'POST', prefer: 'return=minimal', body: { application_id: applicationId, actor_id: actorId, action, entity_id: applicationId } });
}

export default async function handler(request, response) {
  if (!requireMethod(request, response, ['GET', 'POST'])) return;
  if (request.method === 'POST' && !requireAllowedOrigin(request, response)) return;
  try {
    const staff = await requirePrivilegedUser(request);
    if (request.method === 'GET') {
      const applicationId = String(request.query?.applicationId || '').trim();
      if (applicationId) {
        const application = await accessibleApplication(staff, applicationId);
        if (!application) return sendJson(response, 404, { error: 'The fictional test application was not found.' });
        return sendJson(response, 200, await applicationDetails(application));
      }
      const ownerFilter = staff.profile.account_type === 'administrator' ? '' : `&owner_id=eq.${encodeURIComponent(staff.user.id)}`;
      const applications = await serviceRequest(`/rest/v1/applications?select=id,owner_id,program_id,status,policy_version,created_at,updated_at&environment=eq.staging&test_mode=eq.true${ownerFilter}&order=updated_at.desc`);
      const ids = (applications || []).map(item => item.id);
      const applicants = ids.length ? await serviceRequest(`/rest/v1/application_applicants?select=application_id,legal_first_name,legal_last_name&application_id=in.(${ids.join(',')})&person_order=eq.1`) : [];
      const names = new Map((applicants || []).map(item => [item.application_id, `${item.legal_first_name} ${item.legal_last_name}`.trim()]));
      return sendJson(response, 200, { applications: (applications || []).map(item => ({ ...item, applicant_name: names.get(item.id) || 'Applicant not entered' })) });
    }

    const body = requestBody(request);
    const action = String(body.action || '');
    if (action === 'create') {
      const program = getProgram(String(body.programId || ''));
      if (!program) return sendJson(response, 400, { error: 'Select a valid NCDHHS intake pathway.' });
      const created = await serviceRequest('/rest/v1/applications', { method: 'POST', prefer: 'return=representation', body: { owner_id: staff.user.id, program_id: program.id, status: 'draft', policy_version: policyRelease.version, environment: 'staging', test_mode: true } });
      return sendJson(response, 201, { application: created?.[0] });
    }

    const applicationId = String(body.applicationId || '');
    if (!validUuid(applicationId)) return sendJson(response, 400, { error: 'Select a valid fictional application.' });

    if (action === 'review_status') {
      if (staff.profile.account_type !== 'administrator') return sendJson(response, 403, { error: 'Administrator access is required to change review status.' });
      const application = await testApplication(applicationId);
      const status = String(body.status || '');
      if (!application || !reviewStatuses.has(status) || application.status === 'draft') return sendJson(response, 400, { error: 'Select a submitted fictional application and a valid review status.' });
      const updated = await serviceRequest(`/rest/v1/applications?id=eq.${encodeURIComponent(application.id)}`, { method: 'PATCH', prefer: 'return=representation', body: { status } });
      await auditStatus(application.id, staff.user.id, 'review_status_changed');
      return sendJson(response, 200, { application: updated?.[0] });
    }

    if (action === 'submit') {
      const application = await testApplication(applicationId, staff.user.id);
      if (!application || application.status !== 'draft' || !confirmedFictional(body)) return sendJson(response, 400, { error: 'Only an owned fictional draft can be submitted.' });
      const details = await applicationDetails(application);
      if (!details.completion.ready) return sendJson(response, 400, { error: 'Complete every required fictional intake section before submitting.' });
      const updated = await serviceRequest(`/rest/v1/applications?id=eq.${encodeURIComponent(application.id)}`, { method: 'PATCH', prefer: 'return=representation', body: { status: 'submitted' } });
      await auditStatus(application.id, staff.user.id, 'application_submitted');
      return sendJson(response, 200, { application: updated?.[0] });
    }

    const application = await testApplication(applicationId, staff.user.id);
    if (!application || application.status !== 'draft') return sendJson(response, 404, { error: 'The editable fictional test application was not found.' });
    if (!confirmedFictional(body)) return sendJson(response, 400, { error: 'Confirm that every value is fictional test information.' });

    if (action === 'save_applicant') {
      const legalFirstName = text(body.legalFirstName, 80); const legalLastName = text(body.legalLastName, 80); const dateOfBirth = String(body.dateOfBirth || '');
      const preferredLanguage = text(body.preferredLanguage || 'English', 80); const contactEmail = optionalText(body.contactEmail, 254);
      if (!legalFirstName || !legalLastName || !preferredLanguage || !validDate(dateOfBirth)) return sendJson(response, 400, { error: 'Complete the required fictional applicant fields.' });
      if (!validOptionalEmail(contactEmail)) return sendJson(response, 400, { error: 'Enter a valid fictional email address or leave it blank.' });
      const saved = await serviceRequest('/rest/v1/application_applicants?on_conflict=application_id%2Cperson_order', { method: 'POST', prefer: 'resolution=merge-duplicates,return=representation', body: {
        application_id: application.id, person_order: 1, legal_first_name: legalFirstName, legal_middle_name: optionalText(body.legalMiddleName, 80), legal_last_name: legalLastName,
        preferred_name: optionalText(body.preferredName, 80), date_of_birth: dateOfBirth, contact_email: contactEmail, phone: optionalText(body.phone, 30), preferred_language: preferredLanguage,
        nc_county: optionalText(body.ncCounty, 80), applying_for_coverage: body.applyingForCoverage !== false, created_by: staff.user.id
      } });
      return sendJson(response, 200, { applicant: saved?.[0] });
    }

    if (action === 'save_residency') {
      const physicalAddressLine1 = text(body.physicalAddressLine1, 160); const physicalCity = text(body.physicalCity, 100); const physicalState = text(body.physicalState || 'NC', 2).toUpperCase();
      const physicalPostalCode = text(body.physicalPostalCode, 10); const ncCounty = text(body.ncCounty, 80); const mailingSame = body.mailingSame !== false;
      const mailingAddressLine1 = optionalText(body.mailingAddressLine1, 160); const mailingCity = optionalText(body.mailingCity, 100); const mailingState = optionalText(body.mailingState, 2)?.toUpperCase() || null; const mailingPostalCode = optionalText(body.mailingPostalCode, 10);
      if (!physicalAddressLine1 || !physicalCity || physicalState.length !== 2 || !/^\d{5}(-\d{4})?$/.test(physicalPostalCode) || !ncCounty) return sendJson(response, 400, { error: 'Complete the required fictional North Carolina residence fields.' });
      if (!mailingSame && (!mailingAddressLine1 || !mailingCity || !mailingState || !/^\d{5}(-\d{4})?$/.test(mailingPostalCode || ''))) return sendJson(response, 400, { error: 'Complete the fictional mailing address or mark it the same as the home address.' });
      const saved = await serviceRequest('/rest/v1/application_residency?on_conflict=application_id', { method: 'POST', prefer: 'resolution=merge-duplicates,return=representation', body: {
        application_id: application.id, lives_in_nc: body.livesInNc !== false, physical_address_line_1: physicalAddressLine1, physical_address_line_2: optionalText(body.physicalAddressLine2, 160),
        physical_city: physicalCity, physical_state: physicalState, physical_postal_code: physicalPostalCode, nc_county: ncCounty, mailing_same: mailingSame,
        mailing_address_line_1: mailingSame ? null : mailingAddressLine1, mailing_address_line_2: mailingSame ? null : optionalText(body.mailingAddressLine2, 160), mailing_city: mailingSame ? null : mailingCity,
        mailing_state: mailingSame ? null : mailingState, mailing_postal_code: mailingSame ? null : mailingPostalCode, temporarily_absent: body.temporarilyAbsent === true
      } });
      return sendJson(response, 200, { residency: saved?.[0] });
    }

    if (action === 'save_household_member') {
      const memberId = String(body.memberId || ''); const firstName = text(body.firstName, 80); const lastName = text(body.lastName, 80); const dateOfBirth = String(body.dateOfBirth || '');
      const relationship = String(body.relationship || ''); const taxRelationship = String(body.taxRelationship || 'non_filer');
      if (!firstName || !lastName || !validDate(dateOfBirth) || !relationships.has(relationship) || !taxRelationships.has(taxRelationship)) return sendJson(response, 400, { error: 'Complete the required fictional household-member fields.' });
      const member = { application_id: application.id, first_name: firstName, last_name: lastName, date_of_birth: dateOfBirth, relationship_to_applicant: relationship, lives_with_applicant: body.livesWithApplicant !== false, applying_for_coverage: body.applyingForCoverage === true, tax_relationship: taxRelationship, pregnant: body.pregnant === true };
      if (memberId) {
        if (!validUuid(memberId)) return sendJson(response, 400, { error: 'Invalid household member.' });
        const updated = await serviceRequest(`/rest/v1/application_household_members?id=eq.${encodeURIComponent(memberId)}&application_id=eq.${encodeURIComponent(application.id)}`, { method: 'PATCH', prefer: 'return=representation', body: member });
        if (!updated?.length) return sendJson(response, 404, { error: 'The fictional household member was not found.' });
        return sendJson(response, 200, { householdMember: updated[0] });
      }
      const created = await serviceRequest('/rest/v1/application_household_members', { method: 'POST', prefer: 'return=representation', body: member });
      return sendJson(response, 201, { householdMember: created?.[0] });
    }

    if (action === 'delete_household_member') {
      const memberId = String(body.memberId || ''); if (!validUuid(memberId)) return sendJson(response, 400, { error: 'Invalid household member.' });
      const removed = await serviceRequest(`/rest/v1/application_household_members?id=eq.${encodeURIComponent(memberId)}&application_id=eq.${encodeURIComponent(application.id)}`, { method: 'DELETE', prefer: 'return=representation' });
      if (!removed?.length) return sendJson(response, 404, { error: 'The fictional household member was not found.' });
      return sendJson(response, 200, { removed: true });
    }

    if (action === 'save_income_source') {
      const sourceId = String(body.sourceId || ''); const householdMemberId = String(body.householdMemberId || ''); const sourceType = String(body.sourceType || ''); const frequency = String(body.frequency || 'monthly');
      const grossAmount = Number(body.grossAmount); const hoursPerWeek = body.hoursPerWeek === '' || body.hoursPerWeek == null ? null : Number(body.hoursPerWeek);
      if (!incomeTypes.has(sourceType) || !incomeFrequencies.has(frequency) || !Number.isFinite(grossAmount) || grossAmount < 0 || (hoursPerWeek !== null && (!Number.isFinite(hoursPerWeek) || hoursPerWeek < 0 || hoursPerWeek > 168))) return sendJson(response, 400, { error: 'Complete the fictional income source with valid amounts.' });
      if (householdMemberId) {
        if (!validUuid(householdMemberId)) return sendJson(response, 400, { error: 'Select a valid fictional household member.' });
        const members = await serviceRequest(`/rest/v1/application_household_members?select=id&id=eq.${encodeURIComponent(householdMemberId)}&application_id=eq.${encodeURIComponent(application.id)}&limit=1`);
        if (!members?.length) return sendJson(response, 400, { error: 'Select a household member from this test application.' });
      }
      const source = { application_id: application.id, household_member_id: householdMemberId || null, source_type: sourceType, source_name: sourceType === 'no_income' ? null : optionalText(body.sourceName, 160), gross_amount: sourceType === 'no_income' ? 0 : grossAmount, frequency, hours_per_week: sourceType === 'employment' ? hoursPerWeek : null, expected_to_change: body.expectedToChange === true };
      if (sourceId) {
        if (!validUuid(sourceId)) return sendJson(response, 400, { error: 'Invalid income source.' });
        const updated = await serviceRequest(`/rest/v1/application_income_sources?id=eq.${encodeURIComponent(sourceId)}&application_id=eq.${encodeURIComponent(application.id)}`, { method: 'PATCH', prefer: 'return=representation', body: source });
        if (!updated?.length) return sendJson(response, 404, { error: 'The fictional income source was not found.' });
        return sendJson(response, 200, { incomeSource: updated[0] });
      }
      const created = await serviceRequest('/rest/v1/application_income_sources', { method: 'POST', prefer: 'return=representation', body: source });
      return sendJson(response, 201, { incomeSource: created?.[0] });
    }

    if (action === 'delete_income_source') {
      const sourceId = String(body.sourceId || ''); if (!validUuid(sourceId)) return sendJson(response, 400, { error: 'Invalid income source.' });
      const removed = await serviceRequest(`/rest/v1/application_income_sources?id=eq.${encodeURIComponent(sourceId)}&application_id=eq.${encodeURIComponent(application.id)}`, { method: 'DELETE', prefer: 'return=representation' });
      if (!removed?.length) return sendJson(response, 404, { error: 'The fictional income source was not found.' });
      return sendJson(response, 200, { removed: true });
    }

    if (action === 'save_resource') {
      const resourceId = String(body.resourceId || ''); const resourceType = String(body.resourceType || ''); const currentValue = Number(body.currentValue);
      if (!resourceTypes.has(resourceType) || !Number.isFinite(currentValue) || currentValue < 0) return sendJson(response, 400, { error: 'Complete the fictional resource with a valid value.' });
      const record = { application_id: application.id, resource_type: resourceType, owner_label: resourceType === 'none' ? null : optionalText(body.ownerLabel, 120), description: resourceType === 'none' ? null : optionalText(body.description, 200), current_value: resourceType === 'none' ? 0 : currentValue, jointly_owned: resourceType === 'none' ? false : body.jointlyOwned === true };
      if (resourceId) {
        if (!validUuid(resourceId)) return sendJson(response, 400, { error: 'Invalid resource.' });
        const updated = await serviceRequest(`/rest/v1/application_resources?id=eq.${encodeURIComponent(resourceId)}&application_id=eq.${encodeURIComponent(application.id)}`, { method: 'PATCH', prefer: 'return=representation', body: record });
        if (!updated?.length) return sendJson(response, 404, { error: 'The fictional resource was not found.' });
        return sendJson(response, 200, { resource: updated[0] });
      }
      if (resourceType === 'none') await serviceRequest(`/rest/v1/application_resources?application_id=eq.${encodeURIComponent(application.id)}`, { method: 'DELETE' });
      else await serviceRequest(`/rest/v1/application_resources?application_id=eq.${encodeURIComponent(application.id)}&resource_type=eq.none`, { method: 'DELETE' });
      const created = await serviceRequest('/rest/v1/application_resources', { method: 'POST', prefer: 'return=representation', body: record });
      return sendJson(response, 201, { resource: created?.[0] });
    }

    if (action === 'delete_resource') {
      const resourceId = String(body.resourceId || ''); if (!validUuid(resourceId)) return sendJson(response, 400, { error: 'Invalid resource.' });
      const removed = await serviceRequest(`/rest/v1/application_resources?id=eq.${encodeURIComponent(resourceId)}&application_id=eq.${encodeURIComponent(application.id)}`, { method: 'DELETE', prefer: 'return=representation' });
      if (!removed?.length) return sendJson(response, 404, { error: 'The fictional resource was not found.' });
      return sendJson(response, 200, { removed: true });
    }

    if (action === 'save_living_arrangement') {
      const setting = String(body.setting || ''); const levelOfCareStatus = String(body.levelOfCareStatus || 'not_requested'); const fl2Status = String(body.fl2Status || 'not_applicable'); const admissionDate = String(body.admissionDate || '');
      if (!livingSettings.has(setting) || !careStatuses.has(levelOfCareStatus) || !fl2Statuses.has(fl2Status) || !validOptionalDate(admissionDate)) return sendJson(response, 400, { error: 'Complete the fictional living arrangement.' });
      const facilitySetting = ['nursing_facility', 'hospital', 'adult_care_home', 'assisted_living', 'group_home'].includes(setting);
      const saved = await serviceRequest('/rest/v1/application_living_arrangements?on_conflict=application_id', { method: 'POST', prefer: 'resolution=merge-duplicates,return=representation', body: {
        application_id: application.id, setting, facility_name: facilitySetting ? optionalText(body.facilityName, 180) : null, facility_county: facilitySetting ? optionalText(body.facilityCounty, 80) : null,
        admission_date: facilitySetting && admissionDate ? admissionDate : null, spouse_at_home: body.spouseAtHome === true, spouse_name: body.spouseAtHome === true ? optionalText(body.spouseName, 160) : null,
        intends_to_return_home: body.intendsToReturnHome === true, level_of_care_status: levelOfCareStatus, fl2_status: fl2Status
      } });
      return sendJson(response, 200, { livingArrangement: saved?.[0] });
    }

    if (action === 'save_health_coverage') {
      const coverageId = String(body.coverageId || ''); const coverageType = String(body.coverageType || ''); const startDate = String(body.coverageStartDate || ''); const endDate = String(body.coverageEndDate || '');
      if (!coverageTypes.has(coverageType) || !validOptionalDate(startDate) || !validOptionalDate(endDate)) return sendJson(response, 400, { error: 'Complete the fictional health coverage.' });
      const record = { application_id: application.id, coverage_type: coverageType, covered_person: coverageType === 'none' ? null : optionalText(body.coveredPerson, 160), insurer_name: coverageType === 'none' ? null : optionalText(body.insurerName, 180), policyholder_name: coverageType === 'none' ? null : optionalText(body.policyholderName, 160), employment_coverage_available: coverageType === 'none' ? body.employmentCoverageAvailable === true : false, coverage_start_date: coverageType === 'none' || !startDate ? null : startDate, coverage_end_date: coverageType === 'none' || !endDate ? null : endDate };
      if (coverageId) {
        if (!validUuid(coverageId)) return sendJson(response, 400, { error: 'Invalid health coverage.' });
        const updated = await serviceRequest(`/rest/v1/application_health_coverage?id=eq.${encodeURIComponent(coverageId)}&application_id=eq.${encodeURIComponent(application.id)}`, { method: 'PATCH', prefer: 'return=representation', body: record });
        if (!updated?.length) return sendJson(response, 404, { error: 'The fictional health coverage was not found.' });
        return sendJson(response, 200, { healthCoverage: updated[0] });
      }
      if (coverageType === 'none') await serviceRequest(`/rest/v1/application_health_coverage?application_id=eq.${encodeURIComponent(application.id)}`, { method: 'DELETE' });
      else await serviceRequest(`/rest/v1/application_health_coverage?application_id=eq.${encodeURIComponent(application.id)}&coverage_type=eq.none`, { method: 'DELETE' });
      const created = await serviceRequest('/rest/v1/application_health_coverage', { method: 'POST', prefer: 'return=representation', body: record });
      return sendJson(response, 201, { healthCoverage: created?.[0] });
    }

    if (action === 'delete_health_coverage') {
      const coverageId = String(body.coverageId || ''); if (!validUuid(coverageId)) return sendJson(response, 400, { error: 'Invalid health coverage.' });
      const removed = await serviceRequest(`/rest/v1/application_health_coverage?id=eq.${encodeURIComponent(coverageId)}&application_id=eq.${encodeURIComponent(application.id)}`, { method: 'DELETE', prefer: 'return=representation' });
      if (!removed?.length) return sendJson(response, 404, { error: 'The fictional health coverage was not found.' });
      return sendJson(response, 200, { removed: true });
    }

    if (action === 'save_authorized_representative') {
      const wantsRepresentative = body.wantsRepresentative === true; const representativeType = wantsRepresentative ? String(body.representativeType || '') : 'none'; const email = wantsRepresentative ? optionalText(body.email, 254) : null; const authorityScope = String(body.authorityScope || 'application_only');
      if (!representativeTypes.has(representativeType) || !authorityScopes.has(authorityScope) || !validOptionalEmail(email)) return sendJson(response, 400, { error: 'Complete the fictional authorized representative information.' });
      const representativeName = wantsRepresentative ? text(body.representativeName, 160) : null;
      if (wantsRepresentative && !representativeName) return sendJson(response, 400, { error: 'Enter the fictional representative name.' });
      const saved = await serviceRequest('/rest/v1/application_authorized_representatives?on_conflict=application_id', { method: 'POST', prefer: 'resolution=merge-duplicates,return=representation', body: {
        application_id: application.id, wants_representative: wantsRepresentative, representative_type: representativeType, representative_name: representativeName,
        organization_name: wantsRepresentative && representativeType === 'organization' ? optionalText(body.organizationName, 180) : null, relationship: wantsRepresentative ? optionalText(body.relationship, 100) : null,
        phone: wantsRepresentative ? optionalText(body.phone, 30) : null, email, authority_scope: authorityScope, designation_acknowledged: wantsRepresentative ? body.designationAcknowledged === true : false
      } });
      return sendJson(response, 200, { authorizedRepresentative: saved?.[0] });
    }

    return sendJson(response, 400, { error: 'Unsupported intake action.' });
  } catch (error) {
    return safeError(response, error);
  }
}
