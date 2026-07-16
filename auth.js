import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.110.1/+esm';
import { dssForms, getPolicyReferenceUrl, getProgram, getProgramSections, getProgramSources, medicaidPrograms, policyRelease } from './intake-policy.js';

const elements = {
  loading: document.getElementById('loadingScreen'),
  configuration: document.getElementById('configurationScreen'),
  auth: document.getElementById('authShell'),
  dashboard: document.getElementById('dashboardShell'),
  dashboardContent: document.getElementById('dashboardContent'),
  headerViewName: document.getElementById('headerViewName'),
  accountName: document.getElementById('accountName'),
  accountRole: document.getElementById('accountRole'),
  accountInitials: document.getElementById('accountInitials')
};

let supabaseClient;
let currentUser;
let currentProfile;
let deploymentMode = 'staging';
let intakeMode = 'official_guide';

const dashboardViews = {
  applications: {
    title: 'Applications',
    description: 'Review the NCDHHS policy-guided intake pathways before secure intake is enabled.',
    empty: 'No applications have been started.'
  },
  documents: {
    title: 'Documents',
    description: 'A protected document checklist and upload center will be available in a later approved release.',
    empty: 'Document uploads are currently disabled.'
  },
  messages: {
    title: 'Messages',
    description: 'Secure conversations with the MMS team will appear here.',
    empty: 'You do not have any messages.'
  },
  referrals: {
    title: 'Community Referrals',
    description: 'Community resources and referral updates will appear here when assigned.',
    empty: 'You do not have any community referrals.'
  },
  active_clients: {
    title: 'Active Clients',
    description: 'Authorized client assignments will appear here after staff data-access controls are enabled.',
    empty: 'Client access is not enabled in this release.'
  },
  pending_applications: {
    title: 'Pending Applications',
    description: 'Applications requiring staff action will appear here after secure intake is enabled.',
    empty: 'Application review is not enabled in this release.'
  },
  document_review: {
    title: 'Documents Awaiting Review',
    description: 'Protected document-review queues will appear here after compliance approval.',
    empty: 'Document review is currently disabled.'
  },
  tasks: {
    title: 'Tasks',
    description: 'Staff assignments, deadlines, and follow-up work will appear here.',
    empty: 'No staff tasks are available yet.'
  },
  reports: {
    title: 'Reports',
    description: 'Operational reports will be added after role-based reporting controls are complete.',
    empty: 'Reporting is not enabled in this release.'
  },
  organization_approvals: {
    title: 'Organization Approvals',
    description: 'Agency and facility verification requests will be reviewed here.',
    empty: 'The approval workflow is coming next.'
  },
  staff_management: {
    title: 'Staff Management',
    description: 'Administrators will invite staff and manage access from this area.',
    empty: 'The secure staff invitation workflow is coming next.'
  },
  settings: {
    title: 'Settings',
    description: 'Account security and notification preferences will be managed here.',
    empty: 'Additional account settings are coming soon.'
  }
};

function escapeHtml(value = '') {
  return String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
}

async function adminRequest(path, options = {}) {
  const { data } = await supabaseClient.auth.getSession();
  const accessToken = data.session?.access_token;
  if (!accessToken) throw new Error('Your session has expired. Sign in again.');
  const response = await fetch(path, {
    method: options.method || 'GET',
    headers: { Authorization: `Bearer ${accessToken}`, ...(options.body ? { 'Content-Type': 'application/json' } : {}) },
    body: options.body ? JSON.stringify(options.body) : undefined
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || 'The administrator request could not be completed.');
  return payload;
}

function formatAccountDate(value) {
  if (!value) return '—';
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(value));
}

function accountDisplayName(account) {
  return `${account.first_name || ''} ${account.last_name || ''}`.trim() || account.email || 'MMS Connect User';
}

function setBusy(form, busy) {
  const button = form.querySelector('button[type="submit"]');
  if (!button) return;
  if (!button.dataset.label) button.dataset.label = button.textContent;
  button.disabled = busy;
  button.textContent = busy ? 'Please wait…' : button.dataset.label;
}

function showMessage(view, message, type = 'error') {
  const box = document.querySelector(`[data-message="${view}"]`);
  if (!box) return;
  box.textContent = message;
  box.className = `form-message ${type}`;
  box.hidden = false;
}

function clearMessage(view) {
  const box = document.querySelector(`[data-message="${view}"]`);
  if (box) box.hidden = true;
}

function validPassword(password) {
  return password.length >= 12 && /[a-z]/.test(password) && /[A-Z]/.test(password) && /\d/.test(password) && /[^A-Za-z0-9]/.test(password);
}

function friendlyAuthError(error) {
  const message = String(error?.message || '').toLowerCase();
  if (message.includes('invalid login')) return 'The email address or password is incorrect.';
  if (message.includes('email not confirmed')) return 'Please verify your email address before signing in.';
  if (message.includes('rate limit')) return 'Too many attempts were made. Please wait and try again.';
  if (message.includes('weak password')) return 'Choose a stronger password that meets all requirements.';
  if (message.includes('already registered')) return 'An account may already exist for this email address. Try signing in or resetting the password.';
  return 'We could not complete that request. Please try again.';
}

function showOnly(target) {
  elements.loading.hidden = target !== 'loading';
  elements.configuration.hidden = target !== 'configuration';
  elements.auth.hidden = target !== 'auth';
  elements.dashboard.hidden = target !== 'dashboard';
}

function normalizeAuthView() {
  const value = location.hash.replace('#', '').toLowerCase();
  return ['signin', 'register', 'forgot', 'reset'].includes(value) ? value : 'signin';
}

function showAuthView(view = normalizeAuthView()) {
  showOnly('auth');
  document.querySelectorAll('[data-auth-view]').forEach(panel => {
    panel.hidden = panel.dataset.authView !== view;
  });
  const visible = document.querySelector(`[data-auth-view="${view}"]`);
  visible?.querySelector('input')?.focus();
}

async function loadConfiguration() {
  if (window.MMS_CONFIG?.supabaseUrl && window.MMS_CONFIG?.supabasePublishableKey) return window.MMS_CONFIG;
  try {
    const response = await fetch('/api/config', { headers: { Accept: 'application/json' } });
    if (!response.ok) return null;
    const config = await response.json();
    return config.configured ? config : null;
  } catch {
    return null;
  }
}

async function loadProfile(user) {
  const { data, error } = await supabaseClient
    .from('profiles')
    .select('id, first_name, last_name, organization_name, account_type, status, created_at')
    .eq('id', user.id)
    .maybeSingle();

  if (!error && data) return data;
  return {
    id: user.id,
    first_name: user.user_metadata?.first_name || '',
    last_name: user.user_metadata?.last_name || '',
    organization_name: user.user_metadata?.organization_name || '',
    account_type: user.user_metadata?.account_type || 'client',
    status: isOrganizationType(user.user_metadata?.account_type) ? 'pending' : 'active',
    created_at: user.created_at
  };
}

function roleLabel(role) {
  return ({
    client: 'Client',
    authorized_representative: 'Authorized Representative',
    agency: 'Agency',
    facility: 'Facility',
    staff: 'MMS Staff',
    administrator: 'Administrator'
  })[role] || 'Client';
}

function isOrganizationType(accountType) {
  return accountType === 'agency' || accountType === 'facility';
}

function isPrivilegedRole(accountType) {
  return accountType === 'staff' || accountType === 'administrator';
}

function configureDashboardNavigation() {
  const role = currentProfile?.account_type;
  const items = isPrivilegedRole(role)
    ? [
        ['home', 'H', 'Staff Home'],
        ['applications', 'I', 'Intake Programs'],
        ['active_clients', 'C', 'Active Clients'],
        ['pending_applications', 'A', 'Pending Applications'],
        ['document_review', 'D', 'Document Review'],
        ['messages', 'M', 'Messages'],
        ['tasks', 'T', 'Tasks'],
        ['reports', 'R', 'Reports'],
        ...(role === 'administrator' ? [
          ['organization_approvals', 'O', 'Organization Approvals'],
          ['staff_management', 'S', 'Staff Management']
        ] : []),
        ['profile', 'P', 'Profile'],
        ['settings', 'G', 'Settings']
      ]
    : [
        ['home', 'H', 'Home'],
        ['applications', 'A', 'Applications'],
        ['documents', 'D', 'Documents'],
        ['messages', 'M', 'Messages'],
        ['referrals', 'R', 'Community Referrals'],
        ['profile', 'P', 'Profile'],
        ['settings', 'S', 'Settings']
      ];

  document.querySelector('.dashboard-nav').innerHTML = items
    .map(([view, icon, label], index) => `<button class="${index === 0 ? 'active' : ''}" data-dashboard-view="${view}"><span aria-hidden="true">${icon}</span> ${label}</button>`)
    .join('');
}

function syncOrganizationField() {
  const selectedType = document.querySelector('input[name="accountType"]:checked')?.value;
  const field = document.getElementById('organizationNameField');
  const input = document.getElementById('organizationName');
  const organizationSelected = isOrganizationType(selectedType);
  field.hidden = !organizationSelected;
  input.required = organizationSelected;
  if (!organizationSelected) input.value = '';
}

function getDisplayName() {
  const name = `${currentProfile?.first_name || ''} ${currentProfile?.last_name || ''}`.trim();
  return name || currentUser?.email || 'MMS Connect User';
}

function renderHome() {
  const firstName = currentProfile?.first_name || 'there';
  const privileged = isPrivilegedRole(currentProfile?.account_type);
  const verificationPending = isOrganizationType(currentProfile?.account_type) && currentProfile?.status === 'pending';
  elements.headerViewName.textContent = 'Home';
  if (verificationPending) {
    elements.dashboardContent.innerHTML = `
      <section class="welcome">
        <div><p class="eyebrow">Welcome to MMS Connect</p><h1>Hello, ${escapeHtml(firstName)}.</h1><p>Your ${escapeHtml(roleLabel(currentProfile?.account_type).toLowerCase())} account has been created and is awaiting MMS verification.</p></div>
        <span class="status-pill">Verification pending</span>
      </section>
      <div class="safety-banner"><span aria-hidden="true">i</span><div><strong>No confidential submissions yet.</strong><p>MMS will contact your organization after review. Do not enter client, medical, financial, or Medicaid information during this stage.</p></div></div>`;
    return;
  }
  if (privileged) {
    const administrator = currentProfile?.account_type === 'administrator';
    const staffCards = [
      ['applications', 'I', 'Intake Programs', 'Review NCDHHS policy-guided intake pathways.'],
      ['active_clients', 'C', 'Active Clients', 'View authorized client assignments.'],
      ['pending_applications', 'A', 'Pending Applications', 'Review applications requiring action.'],
      ['document_review', 'D', 'Documents Awaiting Review', 'Manage the protected document-review queue.'],
      ['messages', 'M', 'Messages', 'Open secure staff communications.'],
      ['tasks', 'T', 'Tasks', 'Track assignments and deadlines.'],
      ['reports', 'R', 'Reports', 'Review operational reporting.'],
      ...(administrator ? [
        ['organization_approvals', 'O', 'Organization Approvals', 'Review pending agency and facility accounts.'],
        ['staff_management', 'S', 'Staff Management', 'Invite staff and manage access.']
      ] : [])
    ];
    elements.dashboardContent.innerHTML = `
      <section class="welcome">
        <div><p class="eyebrow">MMS Connect Staff Portal</p><h1>Welcome, ${escapeHtml(firstName)}.</h1><p>You are signed in with ${escapeHtml(roleLabel(currentProfile?.account_type))} access. Protected client-data tools remain disabled until their security review is complete.</p></div>
        <span class="status-pill">${escapeHtml(roleLabel(currentProfile?.account_type))}</span>
      </section>
      <div class="safety-banner"><span aria-hidden="true">!</span><div><strong>Do not enter confidential information yet.</strong><p>This staff portal currently contains interface placeholders only. Client records and document access are not enabled.</p></div></div>
      <section class="dashboard-grid" aria-label="Staff areas">
        ${staffCards.map(([view, icon, title, text]) => `<article class="dashboard-card"><span class="card-icon">${icon}</span><h2>${title}</h2><p>${text}</p><button type="button" data-open-view="${view}">Open ${title}</button></article>`).join('')}
      </section>`;
    return;
  }
  elements.dashboardContent.innerHTML = `
    <section class="welcome">
      <div><p class="eyebrow">Welcome to MMS Connect</p><h1>Hello, ${escapeHtml(firstName)}.</h1><p>Your account is ready. The next platform features will appear here as they complete security and privacy review.</p></div>
      <span class="status-pill">Account active</span>
    </section>
    <div class="safety-banner"><span aria-hidden="true">⚠</span><div><strong>Confidential submissions are not enabled.</strong><p>Do not enter Social Security numbers, medical information, financial details, or upload documents yet.</p></div></div>
    <section class="dashboard-grid" aria-label="Account areas">
      ${[
        ['applications', 'A', 'Applications', 'Start and track Medicaid applications.'],
        ['documents', 'D', 'Documents', 'Review document requirements and requests.'],
        ['messages', 'M', 'Messages', 'Communicate securely with the MMS team.'],
        ['referrals', 'R', 'Community Referrals', 'Follow referrals to community resources.'],
        ['profile', 'P', 'Profile', 'Review your account identity and role.'],
        ['settings', 'S', 'Settings', 'Manage security and notification preferences.']
      ].map(([view, icon, title, text]) => `<article class="dashboard-card"><span class="card-icon">${icon}</span><h2>${title}</h2><p>${text}</p><button type="button" data-open-view="${view}">Open ${title}</button></article>`).join('')}
    </section>`;
}

function renderProfile() {
  elements.headerViewName.textContent = 'Profile';
  elements.dashboardContent.innerHTML = `
    <section class="content-heading"><p class="eyebrow">Your account</p><h1>Profile</h1><p>Review the basic identity information associated with this account.</p></section>
    <div class="safety-banner"><span aria-hidden="true">i</span><div><strong>Keep this page free of case details.</strong><p>Applicant, medical, and financial information will be collected through protected workflows in a later release.</p></div></div>
    <section class="profile-card">
      <dl class="profile-list">
        <dt>Name</dt><dd>${escapeHtml(getDisplayName())}</dd>
        ${currentProfile?.organization_name ? `<dt>Organization</dt><dd>${escapeHtml(currentProfile.organization_name)}</dd>` : ''}
        <dt>Email</dt><dd>${escapeHtml(currentUser?.email)}</dd>
        <dt>Account type</dt><dd>${escapeHtml(roleLabel(currentProfile?.account_type))}</dd>
        <dt>Email status</dt><dd>${currentUser?.email_confirmed_at ? 'Verified' : 'Verification pending'}</dd>
        <dt>Account status</dt><dd>${escapeHtml(currentProfile?.status || 'Active')}</dd>
      </dl>
    </section>`;
}

function renderAuditHistory(audit = []) {
  if (!audit.length) return '<p class="admin-empty">No administrator actions have been recorded yet.</p>';
  return `<div class="audit-list">${audit.map(item => `<div class="audit-item"><strong>${escapeHtml(item.action.replaceAll('_', ' '))}</strong><span>${escapeHtml(item.details?.email || item.target_id || 'Account')}</span><time>${escapeHtml(formatAccountDate(item.created_at))}</time></div>`).join('')}</div>`;
}

async function renderStaffManagement(notice = '') {
  elements.headerViewName.textContent = 'Staff Management';
  elements.dashboardContent.innerHTML = `
    <section class="content-heading"><p class="eyebrow">Administrator</p><h1>Staff Management</h1><p>Invite MMS staff and manage privileged access. Staff and administrator roles are never available through public registration.</p></section>
    ${notice ? `<div class="form-message success">${escapeHtml(notice)}</div>` : ''}
    <section class="admin-panel"><h2>Invite a staff member</h2><form id="inviteStaffForm" class="admin-form"><div class="two-fields"><div class="field"><label for="staffFirstName">First name</label><input id="staffFirstName" name="firstName" maxlength="80" required></div><div class="field"><label for="staffLastName">Last name</label><input id="staffLastName" name="lastName" maxlength="80" required></div></div><div class="two-fields"><div class="field"><label for="staffEmail">Work email</label><input id="staffEmail" name="email" type="email" required></div><div class="field"><label for="staffRole">Access level</label><select id="staffRole" name="role"><option value="staff">MMS Staff</option><option value="administrator">Administrator</option></select></div></div><button class="button primary" type="submit">Send secure invitation</button><p class="field-help">The invitation link lets the staff member establish their own password.</p></form></section>
    <section class="admin-panel"><h2>Current staff access</h2><div id="staffAccounts"><p class="admin-empty">Loading staff accounts…</p></div></section>
    <section class="admin-panel"><h2>Recent access history</h2><div id="staffAudit"><p class="admin-empty">Loading history…</p></div></section>`;
  try {
    const { accounts, audit } = await adminRequest('/api/admin/accounts?scope=staff');
    document.getElementById('staffAccounts').innerHTML = accounts.length ? `<div class="admin-table-wrap"><table class="admin-table"><thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Status</th><th>Added</th><th>Actions</th></tr></thead><tbody>${accounts.map(account => { const self = account.id === currentUser?.id; const roleAction = account.account_type === 'administrator' ? 'staff' : 'administrator'; return `<tr><td>${escapeHtml(accountDisplayName(account))}${self ? ' <small>(you)</small>' : ''}</td><td>${escapeHtml(account.email)}</td><td>${escapeHtml(roleLabel(account.account_type))}</td><td>${escapeHtml(account.status)}</td><td>${escapeHtml(formatAccountDate(account.created_at))}</td><td class="admin-actions">${self ? '<span>Protected</span>' : `<button type="button" data-admin-action="set_role" data-target-id="${account.id}" data-role="${roleAction}">Set ${escapeHtml(roleLabel(roleAction))}</button><button type="button" data-admin-action="${account.status === 'active' ? 'suspend_account' : 'restore_account'}" data-target-id="${account.id}">${account.status === 'active' ? 'Suspend' : 'Restore'}</button>`}</td></tr>`; }).join('')}</tbody></table></div>` : '<p class="admin-empty">No staff accounts have been invited yet.</p>';
    document.getElementById('staffAudit').innerHTML = renderAuditHistory(audit);
  } catch (error) {
    document.getElementById('staffAccounts').innerHTML = `<div class="form-message error">${escapeHtml(error.message)}</div>`;
  }
}

async function renderOrganizationApprovals(notice = '') {
  elements.headerViewName.textContent = 'Organization Approvals';
  elements.dashboardContent.innerHTML = `<section class="content-heading"><p class="eyebrow">Administrator</p><h1>Organization Approvals</h1><p>Review agency and facility registrations before organization features are enabled.</p></section>${notice ? `<div class="form-message success">${escapeHtml(notice)}</div>` : ''}<div class="safety-banner"><span aria-hidden="true">i</span><div><strong>Verify organizations outside MMS Connect.</strong><p>Confirm the organization and representative using trusted business contact information before approval.</p></div></div><section class="admin-panel"><h2>Agency and facility accounts</h2><div id="organizationAccounts"><p class="admin-empty">Loading organization accounts…</p></div></section>`;
  try {
    const { accounts } = await adminRequest('/api/admin/accounts?scope=organization');
    document.getElementById('organizationAccounts').innerHTML = accounts.length ? `<div class="admin-table-wrap"><table class="admin-table"><thead><tr><th>Organization</th><th>Representative</th><th>Type</th><th>Email</th><th>Status</th><th>Actions</th></tr></thead><tbody>${accounts.map(account => `<tr><td>${escapeHtml(account.organization_name || 'Not provided')}</td><td>${escapeHtml(accountDisplayName(account))}</td><td>${escapeHtml(roleLabel(account.account_type))}</td><td>${escapeHtml(account.email)}${account.email_verified ? ' <small>Verified</small>' : ' <small>Unverified</small>'}</td><td>${escapeHtml(account.status)}</td><td class="admin-actions">${account.status !== 'active' ? `<button type="button" data-admin-action="approve_organization" data-target-id="${account.id}">Approve</button>` : ''}${account.status === 'pending' ? `<button type="button" data-admin-action="suspend_account" data-target-id="${account.id}">Reject</button>` : account.status === 'active' ? `<button type="button" data-admin-action="suspend_account" data-target-id="${account.id}">Suspend</button>` : ''}</td></tr>`).join('')}</tbody></table></div>` : '<p class="admin-empty">No agency or facility registrations are waiting for review.</p>';
  } catch (error) {
    document.getElementById('organizationAccounts').innerHTML = `<div class="form-message error">${escapeHtml(error.message)}</div>`;
  }
}

function programTitle(programId) {
  return getProgram(programId)?.title || 'NC Medicaid pathway';
}

function policyReferenceLinks(references) {
  return references.map(reference => `<a href="${escapeHtml(getPolicyReferenceUrl(reference))}" target="_blank" rel="noopener noreferrer">${escapeHtml(reference)}</a>`).join(' · ');
}

async function loadOwnedTestApplications() {
  if (!isPrivilegedRole(currentProfile?.account_type)) return [];
  const { applications } = await adminRequest('/api/intake/test-applications');
  return applications || [];
}

function renderTestApplicationList(applications) {
  if (!applications.length) return '<p class="admin-empty">No fictional test applications have been started.</p>';
  return `<div class="test-application-list">${applications.map(application => `<article><div><strong>${escapeHtml(application.applicant_name || programTitle(application.program_id))}</strong><span>${escapeHtml(programTitle(application.program_id))} · ${escapeHtml(application.status.replaceAll('_', ' '))} · Policy ${escapeHtml(application.policy_version)}</span></div><div class="test-case-actions"><button type="button" ${application.status === 'draft' ? `data-resume-test-application="${escapeHtml(application.id)}">Resume` : `data-review-test-application="${escapeHtml(application.id)}">Review`}</button><button type="button" data-reset-test-application="${escapeHtml(application.id)}" data-return-view="applications">Reset</button><button class="danger" type="button" data-delete-test-application="${escapeHtml(application.id)}" data-return-view="applications">Delete</button></div></article>`).join('')}</div>`;
}

async function renderApplications(selectedProgramId = '', notice = '') {
  const guideOnly = intakeMode === 'official_guide';
  elements.headerViewName.textContent = guideOnly ? 'Program Guide & Forms' : 'Applications';
  const groups = [...new Set(medicaidPrograms.map(program => program.group))];
  const selected = getProgram(selectedProgramId);
  const checklist = selected ? getProgramSections(selected.id) : [];
  const sources = selected ? getProgramSources(selected.id) : [];
  const canRunTest = intakeMode === 'fictional_test' && isPrivilegedRole(currentProfile?.account_type);
  let testApplications = [];
  let testLoadError = '';
  if (canRunTest) {
    try { testApplications = await loadOwnedTestApplications(); }
    catch { testLoadError = 'The protected test-intake database is not available yet.'; }
  }

  elements.dashboardContent.innerHTML = `
    <section class="content-heading">
      <p class="eyebrow">NCDHHS policy guide</p>
      <h1>${guideOnly ? 'Explore programs and official forms' : 'Choose an intake pathway'}</h1>
      <p>${guideOnly ? 'Use this guide to understand common NC Medicaid pathways, then apply securely through NC ePASS or your county Department of Social Services.' : 'This preview maps each NC Medicaid pathway to the information MMS Connect will organize. It does not determine eligibility or submit an application to the State.'}</p>
    </section>
    ${notice ? `<div class="form-message success">${escapeHtml(notice)}</div>` : ''}
    <div class="safety-banner"><span aria-hidden="true">${guideOnly ? 'i' : '!'}</span><div><strong>${guideOnly ? 'Official application handoff.' : 'Preview with test scenarios only.'}</strong><p>${guideOnly ? 'MMS Connect does not collect your Medicaid application or confidential documents in this release. Use the official ePASS or DSS links below.' : 'Public intake remains disabled. Only active MMS staff and administrators may save completely fictional staging records for security testing.'}</p></div></div>
    ${canRunTest ? `<section class="test-application-panel"><div><p class="eyebrow">Staging security test</p><h2>Fictional test applications</h2><p>Only active MMS staff and administrators can create these staging-only records.</p></div>${testLoadError ? `<div class="form-message error">${escapeHtml(testLoadError)}</div>` : renderTestApplicationList(testApplications)}</section>` : ''}
    <section class="policy-summary" aria-label="Policy release information">
      <div><span>Policy set</span><strong>NCDHHS ${escapeHtml(policyRelease.version)}</strong></div>
      <div><span>Reviewed</span><strong>${escapeHtml(policyRelease.reviewedOn)}</strong></div>
      <div><span>Decision maker</span><strong>NC Medicaid / County DSS</strong></div>
    </section>
    ${groups.map(group => `
      <section class="program-group">
        <h2>${escapeHtml(group)}</h2>
        <div class="program-grid">
          ${medicaidPrograms.filter(program => program.group === group).map(program => `
            <article class="program-card${selected?.id === program.id ? ' selected' : ''}">
              <h3>${escapeHtml(program.title)}</h3>
              <p>${escapeHtml(program.audience)}</p>
              <small>Policy: ${policyReferenceLinks(program.manualRefs)}</small>
              <button type="button" data-program-id="${escapeHtml(program.id)}">View intake map</button>
            </article>`).join('')}
        </div>
      </section>`).join('')}
    ${selected ? `
      <section class="intake-map" id="intakeMap" tabindex="-1">
        <div class="intake-map-heading">
          <div><p class="eyebrow">Selected pathway</p><h2>${escapeHtml(selected.title)}</h2><p>${escapeHtml(selected.audience)}</p></div>
          <span class="status-pill">Policy preview</span>
        </div>
        <p class="policy-notice">${escapeHtml(policyRelease.notice)}</p>
        <ol class="intake-section-list">
          ${checklist.map((section, index) => `<li><span>${index + 1}</span><div><h3>${escapeHtml(section.title)}</h3><p>${escapeHtml(section.summary)}</p><small>${policyReferenceLinks(section.policy)}</small></div></li>`).join('')}
        </ol>
        ${canRunTest ? `<div class="intake-test-action"><div><strong>Test the protected workflow</strong><p>Create a staging-only draft and use fictional information to test save and resume.</p></div><button class="button primary" type="button" data-start-test-application="${escapeHtml(selected.id)}">Start fictional test</button></div>` : ''}
        ${guideOnly ? `<div class="intake-test-action"><div><strong>Ready to apply?</strong><p>Continue through an official North Carolina application channel. MMS Connect does not transmit an application to the State.</p></div><div class="official-actions"><a class="button primary" href="https://epass.nc.gov/" target="_blank" rel="noopener noreferrer">Apply through ePASS</a><a class="button secondary" href="https://www.ncdhhs.gov/divisions/social-services/local-dss-directory" target="_blank" rel="noopener noreferrer">Find county DSS</a></div></div>` : ''}
        <div class="policy-sources"><h3>Official NCDHHS sources</h3><ul>${sources.map(source => `<li><a href="${escapeHtml(source.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(source.title)}</a></li>`).join('')}</ul><h3>Official NC Medicaid and DSS forms</h3><div class="official-form-grid">${dssForms.map(form => `<a href="${escapeHtml(form.url)}" target="_blank" rel="noopener noreferrer"><strong>${escapeHtml(form.title)}</strong><span>Open official form ↗</span></a>`).join('')}</div><p>Income and resource standards change. MMS Connect links to current official sources instead of treating a displayed amount as an eligibility decision.</p></div>
      </section>` : ''}`;

  if (selected) document.getElementById('intakeMap')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

async function startTestApplication(programId) {
  const program = getProgram(programId);
  if (!program || !isPrivilegedRole(currentProfile?.account_type)) throw new Error('This test pathway is not available.');
  const { application } = await adminRequest('/api/intake/test-applications', { method: 'POST', body: { action: 'create', programId: program.id } });
  await renderApplicantInformation(application.id);
}

async function renderApplicantInformation(applicationId, notice = '') {
  elements.headerViewName.textContent = 'Applicant Information';
  const { application, applicant } = await adminRequest(`/api/intake/test-applications?applicationId=${encodeURIComponent(applicationId)}`);
  if (!application?.test_mode || application.environment !== 'staging') throw new Error('The test application could not be opened.');

  const value = (key, fallback = '') => escapeHtml(applicant?.[key] ?? fallback);
  elements.dashboardContent.innerHTML = `
    <section class="content-heading"><p class="eyebrow">Fictional staging test</p><h1>Applicant Information</h1><p>${escapeHtml(programTitle(application.program_id))} · Policy ${escapeHtml(application.policy_version)}</p></section>
    ${notice ? `<div class="form-message success">${escapeHtml(notice)}</div>` : ''}
    <div class="safety-banner"><span aria-hidden="true">!</span><div><strong>Never enter a real person’s information here.</strong><p>This staging workflow is restricted to MMS staff and administrators for fictional testing. Do not use actual names, birth dates, contact details, case information, or documents.</p></div></div>
    <section class="intake-form-panel">
      <div class="intake-progress"><span>Step 1 of ${getProgramSections(application.program_id).length}</span><strong>Applicant information</strong></div>
      <form id="applicantInfoForm" data-application-id="${escapeHtml(application.id)}">
        <fieldset><legend>Fictional applicant name</legend><div class="three-fields"><div class="field"><label for="applicantFirstName">Legal first name</label><input id="applicantFirstName" name="legalFirstName" maxlength="80" value="${value('legal_first_name')}" required></div><div class="field"><label for="applicantMiddleName">Middle name</label><input id="applicantMiddleName" name="legalMiddleName" maxlength="80" value="${value('legal_middle_name')}"></div><div class="field"><label for="applicantLastName">Legal last name</label><input id="applicantLastName" name="legalLastName" maxlength="80" value="${value('legal_last_name')}" required></div></div><div class="field"><label for="applicantPreferredName">Preferred name</label><input id="applicantPreferredName" name="preferredName" maxlength="80" value="${value('preferred_name')}"></div></fieldset>
        <fieldset><legend>Basic details</legend><div class="two-fields"><div class="field"><label for="applicantDob">Date of birth</label><input id="applicantDob" name="dateOfBirth" type="date" max="${new Date().toISOString().slice(0, 10)}" value="${value('date_of_birth')}" required></div><div class="field"><label for="applicantCounty">North Carolina county</label><input id="applicantCounty" name="ncCounty" maxlength="80" value="${value('nc_county')}"></div></div><div class="two-fields"><div class="field"><label for="applicantLanguage">Preferred language</label><input id="applicantLanguage" name="preferredLanguage" maxlength="80" value="${value('preferred_language', 'English')}" required></div><div class="field"><label for="applicantCoverage">Applying for coverage?</label><select id="applicantCoverage" name="applyingForCoverage"><option value="true" ${applicant?.applying_for_coverage !== false ? 'selected' : ''}>Yes</option><option value="false" ${applicant?.applying_for_coverage === false ? 'selected' : ''}>No</option></select></div></div></fieldset>
        <fieldset><legend>Test contact details</legend><div class="two-fields"><div class="field"><label for="applicantEmail">Email</label><input id="applicantEmail" name="contactEmail" type="email" maxlength="254" value="${value('contact_email')}"></div><div class="field"><label for="applicantPhone">Phone</label><input id="applicantPhone" name="phone" maxlength="30" value="${value('phone')}"></div></div></fieldset>
        <label class="test-confirmation"><input type="checkbox" name="fictionalConfirmation" required><span>I confirm this is completely fictional test information and does not identify a real person.</span></label>
        <div class="intake-form-actions"><button class="button secondary" type="button" data-back-intake-programs>Back to intake programs</button><div><button class="button secondary" type="button" data-open-test-step="household" data-application-id="${escapeHtml(application.id)}">Household &amp; Residency</button><button class="button primary" type="submit">Save test information</button></div></div>
      </form>
    </section>`;
}

async function saveApplicantInformation(form) {
  const values = new FormData(form);
  const applicationId = form.dataset.applicationId;
  await adminRequest('/api/intake/test-applications', { method: 'POST', body: {
    action: 'save_applicant',
    applicationId,
    legalFirstName: values.get('legalFirstName').trim(),
    legalMiddleName: values.get('legalMiddleName').trim(),
    legalLastName: values.get('legalLastName').trim(),
    preferredName: values.get('preferredName').trim(),
    dateOfBirth: values.get('dateOfBirth'),
    contactEmail: values.get('contactEmail').trim(),
    phone: values.get('phone').trim(),
    preferredLanguage: values.get('preferredLanguage').trim(),
    ncCounty: values.get('ncCounty').trim(),
    applyingForCoverage: values.get('applyingForCoverage') === 'true',
    fictionalConfirmation: values.get('fictionalConfirmation') === 'on'
  } });
  await renderApplicantInformation(applicationId, 'Fictional applicant information saved. The audit history was updated.');
}

const relationshipLabels = {
  spouse: 'Spouse', child: 'Child', stepchild: 'Stepchild', parent: 'Parent', stepparent: 'Stepparent', sibling: 'Sibling',
  caretaker_relative: 'Caretaker relative', other_relative: 'Other relative', unrelated: 'Unrelated person', other: 'Other'
};
const taxRelationshipLabels = { tax_filer: 'Files a tax return', joint_filer: 'Files jointly with spouse', tax_dependent: 'Claimed as a tax dependent', non_filer: 'Does not file', not_sure: 'Not sure' };
const incomeTypeLabels = {
  employment: 'Employment', self_employment: 'Self-employment', social_security: 'Social Security', ssi: 'SSI', unemployment: 'Unemployment',
  pension_retirement: 'Pension or retirement', workers_compensation: 'Workers’ compensation', veterans_benefits: 'Veterans benefits',
  alimony: 'Alimony', rental: 'Rental income', interest_dividends: 'Interest or dividends', other: 'Other income', no_income: 'No income'
};
const incomeFrequencyLabels = { hourly: 'Hourly', weekly: 'Weekly', every_two_weeks: 'Every two weeks', twice_monthly: 'Twice monthly', monthly: 'Monthly', quarterly: 'Quarterly', annually: 'Annually', one_time: 'One time' };

async function loadTestApplicationDetails(applicationId) {
  return adminRequest(`/api/intake/test-applications?applicationId=${encodeURIComponent(applicationId)}`);
}

function optionList(labels, selectedValue) {
  return Object.entries(labels).map(([value, label]) => `<option value="${escapeHtml(value)}" ${value === selectedValue ? 'selected' : ''}>${escapeHtml(label)}</option>`).join('');
}

function fictionalConfirmation() {
  return '<label class="test-confirmation"><input type="checkbox" name="fictionalConfirmation" required><span>I confirm every value on this form is fictional and does not identify a real person.</span></label>';
}

async function renderHouseholdResidency(applicationId, notice = '', editMemberId = '') {
  elements.headerViewName.textContent = 'Household & Residency';
  const details = await loadTestApplicationDetails(applicationId);
  const { application, applicant, residency, householdMembers = [] } = details;
  const editing = householdMembers.find(member => member.id === editMemberId) || null;
  const r = (key, fallback = '') => escapeHtml(residency?.[key] ?? fallback);
  const m = (key, fallback = '') => escapeHtml(editing?.[key] ?? fallback);
  const mailingSame = residency?.mailing_same !== false;

  elements.dashboardContent.innerHTML = `
    <section class="content-heading"><p class="eyebrow">Fictional staging test</p><h1>Household &amp; Residency</h1><p>${escapeHtml(programTitle(application.program_id))} · NCDHHS household and North Carolina residency information</p></section>
    ${notice ? `<div class="form-message success">${escapeHtml(notice)}</div>` : ''}
    <div class="safety-banner"><span aria-hidden="true">!</span><div><strong>Fictional information only.</strong><p>Do not enter a real address, household member, pregnancy status, tax relationship, or coverage request.</p></div></div>
    <section class="intake-form-panel">
      <div class="intake-progress"><span>Step 2</span><strong>North Carolina residency</strong></div>
      <form id="residencyForm" data-application-id="${escapeHtml(application.id)}">
        <fieldset><legend>Fictional home address</legend><div class="field"><label for="physicalAddress1">Address line 1</label><input id="physicalAddress1" name="physicalAddressLine1" maxlength="160" value="${r('physical_address_line_1')}" required></div><div class="field"><label for="physicalAddress2">Address line 2</label><input id="physicalAddress2" name="physicalAddressLine2" maxlength="160" value="${r('physical_address_line_2')}"></div><div class="three-fields"><div class="field"><label for="physicalCity">City</label><input id="physicalCity" name="physicalCity" maxlength="100" value="${r('physical_city')}" required></div><div class="field"><label for="physicalState">State</label><input id="physicalState" name="physicalState" maxlength="2" value="${r('physical_state', 'NC')}" required></div><div class="field"><label for="physicalZip">ZIP code</label><input id="physicalZip" name="physicalPostalCode" maxlength="10" pattern="[0-9]{5}(-[0-9]{4})?" value="${r('physical_postal_code')}" required></div></div><div class="two-fields"><div class="field"><label for="residencyCounty">NC county</label><input id="residencyCounty" name="ncCounty" maxlength="80" value="${r('nc_county', applicant?.nc_county || '')}" required></div><div class="field"><label for="livesInNc">Lives in North Carolina?</label><select id="livesInNc" name="livesInNc"><option value="true" ${residency?.lives_in_nc !== false ? 'selected' : ''}>Yes</option><option value="false" ${residency?.lives_in_nc === false ? 'selected' : ''}>No</option></select></div></div><label class="check-row"><input type="checkbox" name="temporarilyAbsent" ${residency?.temporarily_absent ? 'checked' : ''}><span>Fictional applicant is temporarily absent from the home address</span></label></fieldset>
        <fieldset><legend>Fictional mailing address</legend><label class="check-row"><input id="mailingSame" type="checkbox" name="mailingSame" ${mailingSame ? 'checked' : ''}><span>Mailing address is the same as the home address</span></label><div data-mailing-fields ${mailingSame ? 'hidden' : ''}><div class="field"><label for="mailingAddress1">Address line 1</label><input id="mailingAddress1" name="mailingAddressLine1" maxlength="160" value="${r('mailing_address_line_1')}"></div><div class="field"><label for="mailingAddress2">Address line 2</label><input id="mailingAddress2" name="mailingAddressLine2" maxlength="160" value="${r('mailing_address_line_2')}"></div><div class="three-fields"><div class="field"><label for="mailingCity">City</label><input id="mailingCity" name="mailingCity" maxlength="100" value="${r('mailing_city')}"></div><div class="field"><label for="mailingState">State</label><input id="mailingState" name="mailingState" maxlength="2" value="${r('mailing_state', 'NC')}"></div><div class="field"><label for="mailingZip">ZIP code</label><input id="mailingZip" name="mailingPostalCode" maxlength="10" pattern="[0-9]{5}(-[0-9]{4})?" value="${r('mailing_postal_code')}"></div></div></div></fieldset>
        ${fictionalConfirmation()}
        <div class="intake-form-actions"><button class="button secondary" type="button" data-open-test-step="applicant" data-application-id="${escapeHtml(application.id)}">Back to applicant</button><button class="button primary" type="submit">Save residency</button></div>
      </form>
    </section>
    <section class="intake-form-panel">
      <div class="intake-progress"><span>Step 2</span><strong>Additional household members</strong></div>
      ${householdMembers.length ? `<div class="record-list">${householdMembers.map(member => `<article><div><strong>${escapeHtml(member.first_name)} ${escapeHtml(member.last_name)}</strong><span>${escapeHtml(relationshipLabels[member.relationship_to_applicant] || member.relationship_to_applicant)} · ${member.applying_for_coverage ? 'Applying' : 'Not applying'} · ${escapeHtml(taxRelationshipLabels[member.tax_relationship] || member.tax_relationship)}</span></div><div><button type="button" data-edit-household-member="${escapeHtml(member.id)}" data-application-id="${escapeHtml(application.id)}">Edit</button><button type="button" data-delete-household-member="${escapeHtml(member.id)}" data-application-id="${escapeHtml(application.id)}">Remove</button></div></article>`).join('')}</div>` : '<p class="admin-empty">No additional fictional household members have been added.</p>'}
      <form id="householdMemberForm" data-application-id="${escapeHtml(application.id)}" data-member-id="${escapeHtml(editing?.id || '')}">
        <fieldset><legend>${editing ? 'Edit' : 'Add'} fictional household member</legend><div class="three-fields"><div class="field"><label for="memberFirstName">First name</label><input id="memberFirstName" name="firstName" maxlength="80" value="${m('first_name')}" required></div><div class="field"><label for="memberLastName">Last name</label><input id="memberLastName" name="lastName" maxlength="80" value="${m('last_name')}" required></div><div class="field"><label for="memberDob">Date of birth</label><input id="memberDob" name="dateOfBirth" type="date" max="${new Date().toISOString().slice(0, 10)}" value="${m('date_of_birth')}" required></div></div><div class="two-fields"><div class="field"><label for="memberRelationship">Relationship to applicant</label><select id="memberRelationship" name="relationship">${optionList(relationshipLabels, editing?.relationship_to_applicant || 'spouse')}</select></div><div class="field"><label for="memberTax">Tax relationship</label><select id="memberTax" name="taxRelationship">${optionList(taxRelationshipLabels, editing?.tax_relationship || 'non_filer')}</select></div></div><div class="three-fields"><div class="field"><label for="memberLivesWith">Lives with applicant?</label><select id="memberLivesWith" name="livesWithApplicant"><option value="true" ${editing?.lives_with_applicant !== false ? 'selected' : ''}>Yes</option><option value="false" ${editing?.lives_with_applicant === false ? 'selected' : ''}>No</option></select></div><div class="field"><label for="memberApplying">Applying for coverage?</label><select id="memberApplying" name="applyingForCoverage"><option value="false" ${editing?.applying_for_coverage !== true ? 'selected' : ''}>No</option><option value="true" ${editing?.applying_for_coverage === true ? 'selected' : ''}>Yes</option></select></div><div class="field"><label for="memberPregnant">Pregnant?</label><select id="memberPregnant" name="pregnant"><option value="false" ${editing?.pregnant !== true ? 'selected' : ''}>No</option><option value="true" ${editing?.pregnant === true ? 'selected' : ''}>Yes</option></select></div></div></fieldset>
        ${fictionalConfirmation()}
        <div class="intake-form-actions">${editing ? `<button class="button secondary" type="button" data-open-test-step="household" data-application-id="${escapeHtml(application.id)}">Cancel edit</button>` : '<span></span>'}<button class="button primary" type="submit">${editing ? 'Update' : 'Add'} household member</button></div>
      </form>
      <div class="next-step-bar"><div><strong>Next: Income &amp; Employment</strong><p>Add fictional income sources for the applicant and household members.</p></div><button class="button primary" type="button" data-open-test-step="income" data-application-id="${escapeHtml(application.id)}">Continue to income</button></div>
    </section>`;
}

async function renderIncomeEmployment(applicationId, notice = '', editSourceId = '') {
  elements.headerViewName.textContent = 'Income & Employment';
  const details = await loadTestApplicationDetails(applicationId);
  const { application, applicant, householdMembers = [], incomeSources = [] } = details;
  const editing = incomeSources.find(source => source.id === editSourceId) || null;
  const primaryName = `${applicant?.legal_first_name || 'Primary'} ${applicant?.legal_last_name || 'applicant'}`.trim();
  const personName = source => source.household_member_id ? (() => { const member = householdMembers.find(item => item.id === source.household_member_id); return member ? `${member.first_name} ${member.last_name}` : 'Household member'; })() : primaryName;
  const currency = value => new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD' }).format(Number(value || 0));

  elements.dashboardContent.innerHTML = `
    <section class="content-heading"><p class="eyebrow">Fictional staging test</p><h1>Income &amp; Employment</h1><p>${escapeHtml(programTitle(application.program_id))} · Collect gross income before taxes without making an eligibility decision.</p></section>
    ${notice ? `<div class="form-message success">${escapeHtml(notice)}</div>` : ''}
    <div class="safety-banner"><span aria-hidden="true">!</span><div><strong>Use invented amounts and employers only.</strong><p>Do not enter real wages, Social Security benefits, retirement income, business records, or financial information.</p></div></div>
    <section class="intake-form-panel">
      <div class="intake-progress"><span>Step 3</span><strong>Fictional income sources</strong></div>
      ${incomeSources.length ? `<div class="record-list">${incomeSources.map(source => `<article><div><strong>${escapeHtml(personName(source))}: ${escapeHtml(incomeTypeLabels[source.source_type] || source.source_type)}</strong><span>${source.source_type === 'no_income' ? 'No income reported' : `${escapeHtml(currency(source.gross_amount))} · ${escapeHtml(incomeFrequencyLabels[source.frequency] || source.frequency)}`}${source.source_name ? ` · ${escapeHtml(source.source_name)}` : ''}</span></div><div><button type="button" data-edit-income-source="${escapeHtml(source.id)}" data-application-id="${escapeHtml(application.id)}">Edit</button><button type="button" data-delete-income-source="${escapeHtml(source.id)}" data-application-id="${escapeHtml(application.id)}">Remove</button></div></article>`).join('')}</div>` : '<p class="admin-empty">No fictional income sources have been added.</p>'}
      <form id="incomeSourceForm" data-application-id="${escapeHtml(application.id)}" data-source-id="${escapeHtml(editing?.id || '')}">
        <fieldset><legend>${editing ? 'Edit' : 'Add'} fictional income source</legend><div class="two-fields"><div class="field"><label for="incomePerson">Person receiving income</label><select id="incomePerson" name="householdMemberId"><option value="" ${!editing?.household_member_id ? 'selected' : ''}>${escapeHtml(primaryName)} (primary applicant)</option>${householdMembers.map(member => `<option value="${escapeHtml(member.id)}" ${editing?.household_member_id === member.id ? 'selected' : ''}>${escapeHtml(member.first_name)} ${escapeHtml(member.last_name)}</option>`).join('')}</select></div><div class="field"><label for="incomeType">Income type</label><select id="incomeType" name="sourceType">${optionList(incomeTypeLabels, editing?.source_type || 'employment')}</select></div></div><div class="field"><label for="incomeSourceName">Employer or source name</label><input id="incomeSourceName" name="sourceName" maxlength="160" value="${escapeHtml(editing?.source_name || '')}"></div><div class="three-fields"><div class="field"><label for="incomeAmount">Gross amount</label><input id="incomeAmount" name="grossAmount" type="number" min="0" step="0.01" value="${escapeHtml(editing?.gross_amount ?? '0')}" required></div><div class="field"><label for="incomeFrequency">Frequency</label><select id="incomeFrequency" name="frequency">${optionList(incomeFrequencyLabels, editing?.frequency || 'monthly')}</select></div><div class="field"><label for="incomeHours">Hours per week</label><input id="incomeHours" name="hoursPerWeek" type="number" min="0" max="168" step="0.25" value="${escapeHtml(editing?.hours_per_week ?? '')}"></div></div><label class="check-row"><input type="checkbox" name="expectedToChange" ${editing?.expected_to_change ? 'checked' : ''}><span>This fictional income is expected to change</span></label></fieldset>
        ${fictionalConfirmation()}
        <div class="intake-form-actions"><button class="button secondary" type="button" data-open-test-step="household" data-application-id="${escapeHtml(application.id)}">Back to household</button><div>${editing ? `<button class="button secondary" type="button" data-open-test-step="income" data-application-id="${escapeHtml(application.id)}">Cancel edit</button>` : ''}<button class="button primary" type="submit">${editing ? 'Update' : 'Add'} income source</button></div></div>
      </form>
    </section>
    <div class="policy-notice">MMS Connect does not compare these test amounts with an income limit or decide eligibility. Current NCDHHS policy tables and a county DSS determination control the official result.</div>
    <div class="next-step-bar"><div><strong>Next: Resources &amp; Living Arrangement</strong><p>Record fictional assets and the applicant's current setting.</p></div><button class="button primary" type="button" data-open-test-step="resources" data-application-id="${escapeHtml(application.id)}">Continue</button></div>`;
}

const resourceTypeLabels = {
  none: 'No countable resources to report', checking: 'Checking account', savings: 'Savings account', cash: 'Cash', real_property: 'Real property',
  vehicle: 'Vehicle', trust: 'Trust', life_insurance: 'Life insurance', annuity: 'Annuity', retirement_account: 'Retirement account',
  burial_asset: 'Burial asset', able_account: 'ABLE account', other: 'Other resource'
};
const livingSettingLabels = {
  own_home: 'Own home', rent_home: 'Rented home', family_home: 'Home of family or friends', nursing_facility: 'Nursing facility', hospital: 'Hospital',
  adult_care_home: 'Adult care home', assisted_living: 'Assisted living', group_home: 'Group home', without_fixed_address: 'Without a fixed address', other: 'Other setting'
};
const careStatusLabels = { not_requested: 'Not requested', pending: 'Pending', approved: 'Approved', unknown: 'Unknown' };
const fl2StatusLabels = { not_applicable: 'Not applicable', not_available: 'Not available', pending: 'Pending', available: 'Available' };
const coverageTypeLabels = {
  none: 'No current health coverage', employer: 'Employer health coverage', medicare_a: 'Medicare Part A', medicare_b: 'Medicare Part B',
  medicare_d: 'Medicare Part D', medicare_advantage: 'Medicare Advantage', medicaid: 'Medicaid', va: 'VA health coverage', tricare: 'TRICARE',
  marketplace: 'Marketplace plan', private: 'Private insurance', other: 'Other coverage'
};
const representativeTypeLabels = { person: 'Person', organization: 'Organization' };
const authorityScopeLabels = { application_only: 'Application only', notices_and_application: 'Application and notices', full_case: 'Full case communication' };

async function renderResourcesLiving(applicationId, notice = '', editResourceId = '') {
  elements.headerViewName.textContent = 'Resources & Living Arrangement';
  const details = await loadTestApplicationDetails(applicationId);
  const { application, resources = [], livingArrangement } = details;
  const editing = resources.find(resource => resource.id === editResourceId) || null;
  const resourceRequired = getProgramSections(application.program_id).some(section => section.id === 'resources');
  const v = (key, fallback = '') => escapeHtml(livingArrangement?.[key] ?? fallback);
  const currency = value => new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD' }).format(Number(value || 0));
  elements.dashboardContent.innerHTML = `
    <section class="content-heading"><p class="eyebrow">Fictional staging test</p><h1>Resources &amp; Living Arrangement</h1><p>${escapeHtml(programTitle(application.program_id))} · ${resourceRequired ? 'NCDHHS Appendix D and non-MAGI resource pathway' : 'resource information is optional for this pathway'}</p></section>
    ${notice ? `<div class="form-message success">${escapeHtml(notice)}</div>` : ''}
    <div class="safety-banner"><span aria-hidden="true">!</span><div><strong>Invent every asset, value, facility, and spouse detail.</strong><p>Do not enter real bank balances, property, trusts, insurance values, facility admissions, or medical level-of-care information.</p></div></div>
    <section class="intake-form-panel">
      <div class="intake-progress"><span>Step 4</span><strong>Financial resources ${resourceRequired ? '(required for this pathway)' : '(optional for this pathway)'}</strong></div>
      ${resources.length ? `<div class="record-list">${resources.map(resource => `<article><div><strong>${escapeHtml(resourceTypeLabels[resource.resource_type] || resource.resource_type)}</strong><span>${resource.resource_type === 'none' ? 'None reported' : `${escapeHtml(currency(resource.current_value))}${resource.owner_label ? ` · ${escapeHtml(resource.owner_label)}` : ''}`}</span></div><div><button type="button" data-edit-resource="${escapeHtml(resource.id)}" data-application-id="${escapeHtml(application.id)}">Edit</button><button type="button" data-delete-resource="${escapeHtml(resource.id)}" data-application-id="${escapeHtml(application.id)}">Remove</button></div></article>`).join('')}</div>` : '<p class="admin-empty">No fictional resources have been recorded.</p>'}
      <form id="resourceForm" data-application-id="${escapeHtml(application.id)}" data-resource-id="${escapeHtml(editing?.id || '')}">
        <fieldset><legend>${editing ? 'Edit' : 'Add'} fictional resource</legend><div class="two-fields"><div class="field"><label for="resourceType">Resource type</label><select id="resourceType" name="resourceType">${optionList(resourceTypeLabels, editing?.resource_type || 'none')}</select></div><div class="field"><label for="resourceValue">Current value</label><input id="resourceValue" name="currentValue" type="number" min="0" step="0.01" value="${escapeHtml(editing?.current_value ?? '0')}" required></div></div><div class="two-fields"><div class="field"><label for="resourceOwner">Fictional owner</label><input id="resourceOwner" name="ownerLabel" maxlength="120" value="${escapeHtml(editing?.owner_label || '')}"></div><div class="field"><label for="resourceDescription">Description</label><input id="resourceDescription" name="description" maxlength="200" value="${escapeHtml(editing?.description || '')}"></div></div><label class="check-row"><input type="checkbox" name="jointlyOwned" ${editing?.jointly_owned ? 'checked' : ''}><span>Jointly owned</span></label></fieldset>
        ${fictionalConfirmation()}
        <div class="intake-form-actions"><button class="button secondary" type="button" data-open-test-step="income" data-application-id="${escapeHtml(application.id)}">Back to income</button><div>${editing ? `<button class="button secondary" type="button" data-open-test-step="resources" data-application-id="${escapeHtml(application.id)}">Cancel edit</button>` : ''}<button class="button primary" type="submit">${editing ? 'Update' : 'Add'} resource</button></div></div>
      </form>
    </section>
    <section class="intake-form-panel">
      <div class="intake-progress"><span>Step 4</span><strong>Living arrangement and facility information</strong></div>
      <form id="livingArrangementForm" data-application-id="${escapeHtml(application.id)}">
        <fieldset><legend>Current fictional setting</legend><div class="three-fields"><div class="field"><label for="livingSetting">Living arrangement</label><select id="livingSetting" name="setting">${optionList(livingSettingLabels, livingArrangement?.setting || 'rent_home')}</select></div><div class="field"><label for="facilityName">Facility or setting name</label><input id="facilityName" name="facilityName" maxlength="180" value="${v('facility_name')}"></div><div class="field"><label for="facilityCounty">Facility county</label><input id="facilityCounty" name="facilityCounty" maxlength="80" value="${v('facility_county')}"></div></div><div class="three-fields"><div class="field"><label for="admissionDate">Admission date</label><input id="admissionDate" name="admissionDate" type="date" value="${v('admission_date')}"></div><div class="field"><label for="levelOfCare">Level-of-care status</label><select id="levelOfCare" name="levelOfCareStatus">${optionList(careStatusLabels, livingArrangement?.level_of_care_status || 'not_requested')}</select></div><div class="field"><label for="fl2Status">FL-2 status</label><select id="fl2Status" name="fl2Status">${optionList(fl2StatusLabels, livingArrangement?.fl2_status || 'not_applicable')}</select></div></div></fieldset>
        <fieldset><legend>Home and spouse details</legend><div class="field"><label for="spouseName">Fictional spouse at home</label><input id="spouseName" name="spouseName" maxlength="160" value="${v('spouse_name')}"></div><label class="check-row"><input type="checkbox" name="spouseAtHome" ${livingArrangement?.spouse_at_home ? 'checked' : ''}><span>A spouse remains at home</span></label><label class="check-row"><input type="checkbox" name="intendsToReturnHome" ${livingArrangement?.intends_to_return_home ? 'checked' : ''}><span>Applicant intends to return home</span></label></fieldset>
        ${fictionalConfirmation()}
        <div class="intake-form-actions"><span></span><button class="button primary" type="submit">Save living arrangement</button></div>
      </form>
      <div class="next-step-bar"><div><strong>Next: Insurance &amp; Authorized Representative</strong><p>Record fictional coverage and representative choices.</p></div><button class="button primary" type="button" data-open-test-step="coverage" data-application-id="${escapeHtml(application.id)}">Continue</button></div>
    </section>`;
}

async function renderCoverageRepresentative(applicationId, notice = '', editCoverageId = '') {
  elements.headerViewName.textContent = 'Insurance & Authorized Representative';
  const details = await loadTestApplicationDetails(applicationId);
  const { application, applicant, healthCoverage = [], authorizedRepresentative } = details;
  const editing = healthCoverage.find(coverage => coverage.id === editCoverageId) || null;
  const primaryName = `${applicant?.legal_first_name || 'Primary'} ${applicant?.legal_last_name || 'applicant'}`.trim();
  const r = (key, fallback = '') => escapeHtml(authorizedRepresentative?.[key] ?? fallback);
  elements.dashboardContent.innerHTML = `
    <section class="content-heading"><p class="eyebrow">Fictional staging test</p><h1>Insurance &amp; Authorized Representative</h1><p>${escapeHtml(programTitle(application.program_id))} · NCDHHS Appendix A and Appendix C information</p></section>
    ${notice ? `<div class="form-message success">${escapeHtml(notice)}</div>` : ''}
    <div class="safety-banner"><span aria-hidden="true">!</span><div><strong>Use fictional coverage and contacts only.</strong><p>Do not enter real policy numbers, Medicare identifiers, employer plans, phone numbers, email addresses, guardians, or legal representatives.</p></div></div>
    <section class="intake-form-panel">
      <div class="intake-progress"><span>Step 5</span><strong>Health coverage</strong></div>
      ${healthCoverage.length ? `<div class="record-list">${healthCoverage.map(coverage => `<article><div><strong>${escapeHtml(coverageTypeLabels[coverage.coverage_type] || coverage.coverage_type)}</strong><span>${coverage.coverage_type === 'none' ? 'No current coverage reported' : `${escapeHtml(coverage.covered_person || primaryName)}${coverage.insurer_name ? ` · ${escapeHtml(coverage.insurer_name)}` : ''}`}</span></div><div><button type="button" data-edit-health-coverage="${escapeHtml(coverage.id)}" data-application-id="${escapeHtml(application.id)}">Edit</button><button type="button" data-delete-health-coverage="${escapeHtml(coverage.id)}" data-application-id="${escapeHtml(application.id)}">Remove</button></div></article>`).join('')}</div>` : '<p class="admin-empty">No fictional health coverage selection has been recorded.</p>'}
      <form id="healthCoverageForm" data-application-id="${escapeHtml(application.id)}" data-coverage-id="${escapeHtml(editing?.id || '')}">
        <fieldset><legend>${editing ? 'Edit' : 'Add'} fictional coverage</legend><div class="two-fields"><div class="field"><label for="coverageType">Coverage type</label><select id="coverageType" name="coverageType">${optionList(coverageTypeLabels, editing?.coverage_type || 'none')}</select></div><div class="field"><label for="coveredPerson">Covered person</label><input id="coveredPerson" name="coveredPerson" maxlength="160" value="${escapeHtml(editing?.covered_person || primaryName)}"></div></div><div class="two-fields"><div class="field"><label for="insurerName">Insurer or plan name</label><input id="insurerName" name="insurerName" maxlength="180" value="${escapeHtml(editing?.insurer_name || '')}"></div><div class="field"><label for="policyholderName">Policyholder name</label><input id="policyholderName" name="policyholderName" maxlength="160" value="${escapeHtml(editing?.policyholder_name || '')}"></div></div><div class="two-fields"><div class="field"><label for="coverageStart">Coverage start date</label><input id="coverageStart" name="coverageStartDate" type="date" value="${escapeHtml(editing?.coverage_start_date || '')}"></div><div class="field"><label for="coverageEnd">Coverage end date</label><input id="coverageEnd" name="coverageEndDate" type="date" value="${escapeHtml(editing?.coverage_end_date || '')}"></div></div><label class="check-row"><input type="checkbox" name="employmentCoverageAvailable" ${editing?.employment_coverage_available ? 'checked' : ''}><span>Job-based coverage is available to someone in the household</span></label></fieldset>
        ${fictionalConfirmation()}
        <div class="intake-form-actions"><button class="button secondary" type="button" data-open-test-step="resources" data-application-id="${escapeHtml(application.id)}">Back to resources</button><div>${editing ? `<button class="button secondary" type="button" data-open-test-step="coverage" data-application-id="${escapeHtml(application.id)}">Cancel edit</button>` : ''}<button class="button primary" type="submit">${editing ? 'Update' : 'Add'} coverage</button></div></div>
      </form>
    </section>
    <section class="intake-form-panel">
      <div class="intake-progress"><span>Step 5</span><strong>Authorized representative choice</strong></div>
      <form id="authorizedRepresentativeForm" data-application-id="${escapeHtml(application.id)}">
        <fieldset><legend>Representative selection</legend><div class="two-fields"><div class="field"><label for="wantsRepresentative">Choose a representative?</label><select id="wantsRepresentative" name="wantsRepresentative"><option value="false" ${authorizedRepresentative?.wants_representative !== true ? 'selected' : ''}>No</option><option value="true" ${authorizedRepresentative?.wants_representative === true ? 'selected' : ''}>Yes</option></select></div><div class="field"><label for="representativeType">Representative type</label><select id="representativeType" name="representativeType">${optionList(representativeTypeLabels, authorizedRepresentative?.representative_type === 'organization' ? 'organization' : 'person')}</select></div></div><div class="three-fields"><div class="field"><label for="representativeName">Representative name</label><input id="representativeName" name="representativeName" maxlength="160" value="${r('representative_name')}"></div><div class="field"><label for="representativeOrganization">Organization</label><input id="representativeOrganization" name="organizationName" maxlength="180" value="${r('organization_name')}"></div><div class="field"><label for="representativeRelationship">Relationship</label><input id="representativeRelationship" name="relationship" maxlength="100" value="${r('relationship')}"></div></div><div class="three-fields"><div class="field"><label for="representativePhone">Phone</label><input id="representativePhone" name="phone" maxlength="30" value="${r('phone')}"></div><div class="field"><label for="representativeEmail">Email</label><input id="representativeEmail" name="email" type="email" maxlength="254" value="${r('email')}"></div><div class="field"><label for="authorityScope">Authority scope</label><select id="authorityScope" name="authorityScope">${optionList(authorityScopeLabels, authorizedRepresentative?.authority_scope || 'application_only')}</select></div></div><label class="check-row"><input type="checkbox" name="designationAcknowledged" ${authorizedRepresentative?.designation_acknowledged ? 'checked' : ''}><span>Fictional designation authority has been acknowledged</span></label></fieldset>
        ${fictionalConfirmation()}
        <div class="intake-form-actions"><span></span><button class="button primary" type="submit">Save representative choice</button></div>
      </form>
      <div class="next-step-bar"><div><strong>Next: Review &amp; Submit</strong><p>Check required sections and submit the fictional case to the administrator queue.</p></div><button class="button primary" type="button" data-open-test-step="review" data-application-id="${escapeHtml(application.id)}">Review application</button></div>
    </section>`;
}

async function renderApplicationReview(applicationId, notice = '') {
  elements.headerViewName.textContent = 'Review & Submit';
  const details = await loadTestApplicationDetails(applicationId);
  const { application, applicant, householdMembers = [], incomeSources = [], resources = [], healthCoverage = [], livingArrangement, authorizedRepresentative, completion } = details;
  const checks = [
    ['Applicant information', completion.applicant, 'applicant'], ['Residency', completion.residency, 'household'], ['Income or no-income selection', completion.income, 'income'],
    [`Resources${completion.resourcesRequired ? '' : ' (not required for this pathway)'}`, completion.resources, 'resources'], ['Living arrangement', completion.livingArrangement, 'resources'],
    ['Health coverage or no-coverage selection', completion.healthCoverage, 'coverage'], ['Authorized representative choice', completion.authorizedRepresentative, 'coverage']
  ];
  const administrator = currentProfile?.account_type === 'administrator';
  const editableOwner = application.owner_id === currentUser?.id && application.status === 'draft';
  elements.dashboardContent.innerHTML = `
    <section class="content-heading"><p class="eyebrow">Fictional staging test</p><h1>Review &amp; Submit</h1><p>${escapeHtml(programTitle(application.program_id))} · Status: ${escapeHtml(application.status.replaceAll('_', ' '))}</p></section>
    ${notice ? `<div class="form-message success">${escapeHtml(notice)}</div>` : ''}
    <div class="safety-banner"><span aria-hidden="true">!</span><div><strong>This does not submit anything to NC Medicaid or a county DSS.</strong><p>It places a completely fictional staging record into the MMS administrator test queue only.</p></div></div>
    <section class="review-grid">
      <article><span>Applicant</span><strong>${escapeHtml(applicant ? `${applicant.legal_first_name} ${applicant.legal_last_name}` : 'Not entered')}</strong><small>${householdMembers.length} additional household member(s)</small></article>
      <article><span>Income</span><strong>${incomeSources.length} source(s)</strong><small>No eligibility calculation performed</small></article>
      <article><span>Resources</span><strong>${resources.length} selection(s)</strong><small>${completion.resourcesRequired ? 'Required pathway' : 'Optional pathway'}</small></article>
      <article><span>Living setting</span><strong>${escapeHtml(livingArrangement ? livingSettingLabels[livingArrangement.setting] || livingArrangement.setting : 'Not entered')}</strong><small>FL-2: ${escapeHtml(livingArrangement ? fl2StatusLabels[livingArrangement.fl2_status] : 'Not entered')}</small></article>
      <article><span>Coverage</span><strong>${healthCoverage.length} selection(s)</strong><small>Appendix A information</small></article>
      <article><span>Representative</span><strong>${authorizedRepresentative ? (authorizedRepresentative.wants_representative ? 'Representative selected' : 'No representative') : 'Not entered'}</strong><small>Appendix C information</small></article>
    </section>
    <section class="intake-form-panel"><div class="intake-progress"><span>Step 6</span><strong>Required-section check</strong></div><div class="completion-list">${checks.map(([label, complete, step]) => `<button type="button" class="${complete ? 'complete' : 'incomplete'}" data-open-test-step="${step}" data-application-id="${escapeHtml(application.id)}"><span>${complete ? '✓' : '!'}</span><strong>${escapeHtml(label)}</strong><small>${complete ? 'Complete' : 'Needs information'}</small></button>`).join('')}</div>
      ${editableOwner ? `<label class="test-confirmation"><input id="submitFictionalConfirmation" type="checkbox"><span>I confirm the entire application is fictional and authorize submission to the MMS staging review queue.</span></label><div class="intake-form-actions"><button class="button secondary" type="button" data-open-test-step="coverage" data-application-id="${escapeHtml(application.id)}">Back to coverage</button><button class="button primary" type="button" data-submit-test-application="${escapeHtml(application.id)}" ${completion.ready ? '' : 'disabled'}>Submit fictional application</button></div>` : `<div class="policy-notice">This fictional application is read-only because its status is ${escapeHtml(application.status.replaceAll('_', ' '))}.</div>`}
    </section>
    ${administrator && application.status !== 'draft' ? `<section class="admin-panel"><h2>Administrator review</h2><form id="reviewStatusForm" data-application-id="${escapeHtml(application.id)}"><div class="two-fields"><div class="field"><label for="reviewStatus">Review status</label><select id="reviewStatus" name="status">${optionList({ under_review: 'Under review', information_requested: 'Information requested', approved: 'Approved test', denied: 'Denied test', closed: 'Closed' }, application.status === 'submitted' ? 'under_review' : application.status)}</select></div><div class="field"><label>Safety boundary</label><p class="field-help">Status changes apply only to this fictional staging record.</p></div></div><button class="button primary" type="submit">Update review status</button></form></section>` : ''}`;
}

async function renderApplicationQueue(notice = '') {
  elements.headerViewName.textContent = 'Pending Applications';
  const { applications = [] } = await adminRequest('/api/intake/test-applications');
  const queue = currentProfile?.account_type === 'administrator' ? applications.filter(item => item.status !== 'draft') : applications.filter(item => item.status !== 'draft');
  elements.dashboardContent.innerHTML = `<section class="content-heading"><p class="eyebrow">MMS staging review</p><h1>Application Queue</h1><p>Review fictional submissions without exposing the queue to public or organization accounts.</p></section>${notice ? `<div class="form-message success">${escapeHtml(notice)}</div>` : ''}<div class="safety-banner"><span aria-hidden="true">!</span><div><strong>Fictional test records only.</strong><p>No item in this queue is an official Medicaid application or eligibility decision.</p></div></div><section class="admin-panel"><h2>Submitted test applications</h2>${queue.length ? `<div class="admin-table-wrap"><table class="admin-table"><thead><tr><th>Applicant</th><th>Pathway</th><th>Status</th><th>Updated</th><th>Actions</th></tr></thead><tbody>${queue.map(item => `<tr><td>${escapeHtml(item.applicant_name)}</td><td>${escapeHtml(programTitle(item.program_id))}</td><td><span class="status-pill">${escapeHtml(item.status.replaceAll('_', ' '))}</span></td><td>${escapeHtml(formatAccountDate(item.updated_at))}</td><td class="admin-actions"><button type="button" data-review-test-application="${escapeHtml(item.id)}">Open review</button><button type="button" data-reset-test-application="${escapeHtml(item.id)}" data-return-view="queue">Reset</button><button type="button" data-delete-test-application="${escapeHtml(item.id)}" data-return-view="queue">Delete</button></td></tr>`).join('')}</tbody></table></div>` : '<p class="admin-empty">No fictional applications have been submitted for review.</p>'}</section>`;
}

async function saveResidency(form) {
  const values = new FormData(form);
  const applicationId = form.dataset.applicationId;
  await adminRequest('/api/intake/test-applications', { method: 'POST', body: {
    action: 'save_residency', applicationId, physicalAddressLine1: values.get('physicalAddressLine1'), physicalAddressLine2: values.get('physicalAddressLine2'),
    physicalCity: values.get('physicalCity'), physicalState: values.get('physicalState'), physicalPostalCode: values.get('physicalPostalCode'), ncCounty: values.get('ncCounty'),
    livesInNc: values.get('livesInNc') === 'true', temporarilyAbsent: values.get('temporarilyAbsent') === 'on', mailingSame: values.get('mailingSame') === 'on',
    mailingAddressLine1: values.get('mailingAddressLine1'), mailingAddressLine2: values.get('mailingAddressLine2'), mailingCity: values.get('mailingCity'), mailingState: values.get('mailingState'), mailingPostalCode: values.get('mailingPostalCode'),
    fictionalConfirmation: values.get('fictionalConfirmation') === 'on'
  } });
  await renderHouseholdResidency(applicationId, 'Fictional residency information saved.');
}

async function saveHouseholdMember(form) {
  const values = new FormData(form);
  const applicationId = form.dataset.applicationId;
  await adminRequest('/api/intake/test-applications', { method: 'POST', body: {
    action: 'save_household_member', applicationId, memberId: form.dataset.memberId || '', firstName: values.get('firstName'), lastName: values.get('lastName'), dateOfBirth: values.get('dateOfBirth'),
    relationship: values.get('relationship'), taxRelationship: values.get('taxRelationship'), livesWithApplicant: values.get('livesWithApplicant') === 'true', applyingForCoverage: values.get('applyingForCoverage') === 'true', pregnant: values.get('pregnant') === 'true', fictionalConfirmation: values.get('fictionalConfirmation') === 'on'
  } });
  await renderHouseholdResidency(applicationId, `Fictional household member ${form.dataset.memberId ? 'updated' : 'added'}.`);
}

async function saveIncomeSource(form) {
  const values = new FormData(form);
  const applicationId = form.dataset.applicationId;
  await adminRequest('/api/intake/test-applications', { method: 'POST', body: {
    action: 'save_income_source', applicationId, sourceId: form.dataset.sourceId || '', householdMemberId: values.get('householdMemberId'), sourceType: values.get('sourceType'), sourceName: values.get('sourceName'), grossAmount: values.get('grossAmount'), frequency: values.get('frequency'), hoursPerWeek: values.get('hoursPerWeek'), expectedToChange: values.get('expectedToChange') === 'on', fictionalConfirmation: values.get('fictionalConfirmation') === 'on'
  } });
  await renderIncomeEmployment(applicationId, `Fictional income source ${form.dataset.sourceId ? 'updated' : 'added'}.`);
}

async function saveResource(form) {
  const values = new FormData(form); const applicationId = form.dataset.applicationId;
  await adminRequest('/api/intake/test-applications', { method: 'POST', body: {
    action: 'save_resource', applicationId, resourceId: form.dataset.resourceId || '', resourceType: values.get('resourceType'), ownerLabel: values.get('ownerLabel'),
    description: values.get('description'), currentValue: values.get('currentValue'), jointlyOwned: values.get('jointlyOwned') === 'on', fictionalConfirmation: values.get('fictionalConfirmation') === 'on'
  } });
  await renderResourcesLiving(applicationId, `Fictional resource ${form.dataset.resourceId ? 'updated' : 'added'}.`);
}

async function saveLivingArrangement(form) {
  const values = new FormData(form); const applicationId = form.dataset.applicationId;
  await adminRequest('/api/intake/test-applications', { method: 'POST', body: {
    action: 'save_living_arrangement', applicationId, setting: values.get('setting'), facilityName: values.get('facilityName'), facilityCounty: values.get('facilityCounty'), admissionDate: values.get('admissionDate'),
    spouseAtHome: values.get('spouseAtHome') === 'on', spouseName: values.get('spouseName'), intendsToReturnHome: values.get('intendsToReturnHome') === 'on',
    levelOfCareStatus: values.get('levelOfCareStatus'), fl2Status: values.get('fl2Status'), fictionalConfirmation: values.get('fictionalConfirmation') === 'on'
  } });
  await renderResourcesLiving(applicationId, 'Fictional living arrangement saved.');
}

async function saveHealthCoverage(form) {
  const values = new FormData(form); const applicationId = form.dataset.applicationId;
  await adminRequest('/api/intake/test-applications', { method: 'POST', body: {
    action: 'save_health_coverage', applicationId, coverageId: form.dataset.coverageId || '', coverageType: values.get('coverageType'), coveredPerson: values.get('coveredPerson'),
    insurerName: values.get('insurerName'), policyholderName: values.get('policyholderName'), employmentCoverageAvailable: values.get('employmentCoverageAvailable') === 'on',
    coverageStartDate: values.get('coverageStartDate'), coverageEndDate: values.get('coverageEndDate'), fictionalConfirmation: values.get('fictionalConfirmation') === 'on'
  } });
  await renderCoverageRepresentative(applicationId, `Fictional coverage ${form.dataset.coverageId ? 'updated' : 'added'}.`);
}

async function saveAuthorizedRepresentative(form) {
  const values = new FormData(form); const applicationId = form.dataset.applicationId;
  await adminRequest('/api/intake/test-applications', { method: 'POST', body: {
    action: 'save_authorized_representative', applicationId, wantsRepresentative: values.get('wantsRepresentative') === 'true', representativeType: values.get('representativeType'),
    representativeName: values.get('representativeName'), organizationName: values.get('organizationName'), relationship: values.get('relationship'), phone: values.get('phone'), email: values.get('email'),
    authorityScope: values.get('authorityScope'), designationAcknowledged: values.get('designationAcknowledged') === 'on', fictionalConfirmation: values.get('fictionalConfirmation') === 'on'
  } });
  await renderCoverageRepresentative(applicationId, 'Fictional authorized representative choice saved.');
}

function renderPlaceholder(view) {
  const item = dashboardViews[view];
  elements.headerViewName.textContent = item.title;
  elements.dashboardContent.innerHTML = `
    <section class="content-heading"><p class="eyebrow">MMS Connect</p><h1>${escapeHtml(item.title)}</h1><p>${escapeHtml(item.description)}</p></section>
    <div class="empty-panel"><span class="card-icon" style="margin:0 auto 16px">+</span><h2>${escapeHtml(item.empty)}</h2><p>This area is intentionally empty while the next secure workflow is being built.</p></div>`;
}

function openDashboardView(view) {
  document.querySelectorAll('[data-dashboard-view]').forEach(button => button.classList.toggle('active', button.dataset.dashboardView === view));
  elements.dashboard.classList.remove('nav-open');
  if (view === 'home') renderHome();
  else if (view === 'profile') renderProfile();
  else if (view === 'applications') void renderApplications();
  else if (view === 'pending_applications' && isPrivilegedRole(currentProfile?.account_type)) void renderApplicationQueue();
  else if (view === 'staff_management' && currentProfile?.account_type === 'administrator') void renderStaffManagement();
  else if (view === 'organization_approvals' && currentProfile?.account_type === 'administrator') void renderOrganizationApprovals();
  else renderPlaceholder(view);
  elements.dashboardContent.focus();
}

async function showDashboard(user) {
  currentUser = user;
  currentProfile = await loadProfile(user);

  const organizationPending = isOrganizationType(currentProfile?.account_type) && currentProfile?.status === 'pending';
  if (currentProfile?.status && currentProfile.status !== 'active' && !organizationPending) {
    await supabaseClient.auth.signOut({ scope: 'local' });
    showAuthView('signin');
    showMessage('signin', 'This account is not active. Contact MMS Connect support for assistance.');
    return;
  }

  const displayName = getDisplayName();
  elements.accountName.textContent = displayName;
  elements.accountRole.textContent = roleLabel(currentProfile?.account_type);
  elements.accountInitials.textContent = displayName.split(/\s+/).slice(0, 2).map(part => part[0]).join('').toUpperCase();
  configureDashboardNavigation();
  showOnly('dashboard');
  openDashboardView('home');
}

function wireInterface() {
  document.querySelectorAll('[data-current-year]').forEach(node => { node.textContent = new Date().getFullYear(); });

  document.querySelectorAll('input[name="accountType"]').forEach(input => input.addEventListener('change', syncOrganizationField));
  syncOrganizationField();

  window.addEventListener('hashchange', () => {
    if (!currentUser) showAuthView();
  });

  document.querySelectorAll('[data-toggle-password]').forEach(button => {
    button.addEventListener('click', () => {
      const input = document.getElementById(button.dataset.togglePassword);
      const showing = input.type === 'text';
      input.type = showing ? 'password' : 'text';
      button.textContent = showing ? 'Show' : 'Hide';
      button.setAttribute('aria-label', showing ? 'Show password' : 'Hide password');
    });
  });

  document.querySelector('.dashboard-nav').addEventListener('click', event => {
    const button = event.target.closest('[data-dashboard-view]');
    if (button) openDashboardView(button.dataset.dashboardView);
  });
  elements.dashboardContent.addEventListener('click', event => {
    const button = event.target.closest('[data-open-view]');
    if (button) return openDashboardView(button.dataset.openView);
    const programButton = event.target.closest('[data-program-id]');
    if (programButton) return void renderApplications(programButton.dataset.programId);
    const startTestButton = event.target.closest('[data-start-test-application]');
    if (startTestButton) {
      startTestButton.disabled = true;
      return void startTestApplication(startTestButton.dataset.startTestApplication).catch(error => { startTestButton.disabled = false; window.alert(error.message); });
    }
    const resumeTestButton = event.target.closest('[data-resume-test-application]');
    if (resumeTestButton) return void renderApplicantInformation(resumeTestButton.dataset.resumeTestApplication).catch(error => window.alert(error.message));
    const reviewTestButton = event.target.closest('[data-review-test-application]');
    if (reviewTestButton) return void renderApplicationReview(reviewTestButton.dataset.reviewTestApplication).catch(error => window.alert(error.message));
    const resetTestButton = event.target.closest('[data-reset-test-application]');
    if (resetTestButton) {
      if (!window.confirm('Reset this fictional case? All entered test information will be removed and the pathway will return to a blank draft.')) return;
      resetTestButton.disabled = true;
      return void adminRequest('/api/intake/test-applications', { method: 'POST', body: { action: 'reset', applicationId: resetTestButton.dataset.resetTestApplication, fictionalConfirmation: true } })
        .then(() => resetTestButton.dataset.returnView === 'queue' ? renderApplicationQueue('Fictional test case reset to a blank draft.') : renderApplications('', 'Fictional test case reset to a blank draft.'))
        .catch(error => { resetTestButton.disabled = false; window.alert(error.message); });
    }
    const deleteTestButton = event.target.closest('[data-delete-test-application]');
    if (deleteTestButton) {
      if (!window.confirm('Permanently delete this fictional test case? This cannot be undone.')) return;
      deleteTestButton.disabled = true;
      return void adminRequest('/api/intake/test-applications', { method: 'POST', body: { action: 'delete_application', applicationId: deleteTestButton.dataset.deleteTestApplication, fictionalConfirmation: true } })
        .then(() => deleteTestButton.dataset.returnView === 'queue' ? renderApplicationQueue('Fictional test case deleted.') : renderApplications('', 'Fictional test case deleted.'))
        .catch(error => { deleteTestButton.disabled = false; window.alert(error.message); });
    }
    if (event.target.closest('[data-back-intake-programs]')) return void renderApplications();
    const stepButton = event.target.closest('[data-open-test-step]');
    if (stepButton) {
      const applicationId = stepButton.dataset.applicationId;
      const step = stepButton.dataset.openTestStep;
      if (step === 'applicant') return void renderApplicantInformation(applicationId).catch(error => window.alert(error.message));
      if (step === 'household') return void renderHouseholdResidency(applicationId).catch(error => window.alert(error.message));
      if (step === 'income') return void renderIncomeEmployment(applicationId).catch(error => window.alert(error.message));
      if (step === 'resources') return void renderResourcesLiving(applicationId).catch(error => window.alert(error.message));
      if (step === 'coverage') return void renderCoverageRepresentative(applicationId).catch(error => window.alert(error.message));
      if (step === 'review') return void renderApplicationReview(applicationId).catch(error => window.alert(error.message));
    }
    const editMemberButton = event.target.closest('[data-edit-household-member]');
    if (editMemberButton) return void renderHouseholdResidency(editMemberButton.dataset.applicationId, '', editMemberButton.dataset.editHouseholdMember).catch(error => window.alert(error.message));
    const deleteMemberButton = event.target.closest('[data-delete-household-member]');
    if (deleteMemberButton) {
      if (!window.confirm('Remove this fictional household member and any linked fictional income sources?')) return;
      deleteMemberButton.disabled = true;
      return void adminRequest('/api/intake/test-applications', { method: 'POST', body: { action: 'delete_household_member', applicationId: deleteMemberButton.dataset.applicationId, memberId: deleteMemberButton.dataset.deleteHouseholdMember, fictionalConfirmation: true } })
        .then(() => renderHouseholdResidency(deleteMemberButton.dataset.applicationId, 'Fictional household member removed.'))
        .catch(error => { deleteMemberButton.disabled = false; window.alert(error.message); });
    }
    const editIncomeButton = event.target.closest('[data-edit-income-source]');
    if (editIncomeButton) return void renderIncomeEmployment(editIncomeButton.dataset.applicationId, '', editIncomeButton.dataset.editIncomeSource).catch(error => window.alert(error.message));
    const deleteIncomeButton = event.target.closest('[data-delete-income-source]');
    if (deleteIncomeButton) {
      if (!window.confirm('Remove this fictional income source?')) return;
      deleteIncomeButton.disabled = true;
      return void adminRequest('/api/intake/test-applications', { method: 'POST', body: { action: 'delete_income_source', applicationId: deleteIncomeButton.dataset.applicationId, sourceId: deleteIncomeButton.dataset.deleteIncomeSource, fictionalConfirmation: true } })
        .then(() => renderIncomeEmployment(deleteIncomeButton.dataset.applicationId, 'Fictional income source removed.'))
        .catch(error => { deleteIncomeButton.disabled = false; window.alert(error.message); });
    }
    const editResourceButton = event.target.closest('[data-edit-resource]');
    if (editResourceButton) return void renderResourcesLiving(editResourceButton.dataset.applicationId, '', editResourceButton.dataset.editResource).catch(error => window.alert(error.message));
    const deleteResourceButton = event.target.closest('[data-delete-resource]');
    if (deleteResourceButton) {
      if (!window.confirm('Remove this fictional resource?')) return;
      deleteResourceButton.disabled = true;
      return void adminRequest('/api/intake/test-applications', { method: 'POST', body: { action: 'delete_resource', applicationId: deleteResourceButton.dataset.applicationId, resourceId: deleteResourceButton.dataset.deleteResource, fictionalConfirmation: true } })
        .then(() => renderResourcesLiving(deleteResourceButton.dataset.applicationId, 'Fictional resource removed.'))
        .catch(error => { deleteResourceButton.disabled = false; window.alert(error.message); });
    }
    const editCoverageButton = event.target.closest('[data-edit-health-coverage]');
    if (editCoverageButton) return void renderCoverageRepresentative(editCoverageButton.dataset.applicationId, '', editCoverageButton.dataset.editHealthCoverage).catch(error => window.alert(error.message));
    const deleteCoverageButton = event.target.closest('[data-delete-health-coverage]');
    if (deleteCoverageButton) {
      if (!window.confirm('Remove this fictional coverage?')) return;
      deleteCoverageButton.disabled = true;
      return void adminRequest('/api/intake/test-applications', { method: 'POST', body: { action: 'delete_health_coverage', applicationId: deleteCoverageButton.dataset.applicationId, coverageId: deleteCoverageButton.dataset.deleteHealthCoverage, fictionalConfirmation: true } })
        .then(() => renderCoverageRepresentative(deleteCoverageButton.dataset.applicationId, 'Fictional coverage removed.'))
        .catch(error => { deleteCoverageButton.disabled = false; window.alert(error.message); });
    }
    const submitApplicationButton = event.target.closest('[data-submit-test-application]');
    if (submitApplicationButton) {
      const confirmation = document.getElementById('submitFictionalConfirmation');
      if (!confirmation?.checked) return void window.alert('Confirm that the entire application is fictional before submitting.');
      if (!window.confirm('Submit this fictional application to the MMS staging administrator queue?')) return;
      submitApplicationButton.disabled = true;
      return void adminRequest('/api/intake/test-applications', { method: 'POST', body: { action: 'submit', applicationId: submitApplicationButton.dataset.submitTestApplication, fictionalConfirmation: true } })
        .then(() => renderApplicationReview(submitApplicationButton.dataset.submitTestApplication, 'Fictional application submitted to the staging review queue.'))
        .catch(error => { submitApplicationButton.disabled = false; window.alert(error.message); });
    }
    const adminButton = event.target.closest('[data-admin-action]');
    if (!adminButton) return;
    const action = adminButton.dataset.adminAction;
    const targetId = adminButton.dataset.targetId;
    const role = adminButton.dataset.role;
    if (action === 'suspend_account' && !window.confirm('Suspend this account? The user will be unable to access MMS Connect.')) return;
    adminButton.disabled = true;
    adminRequest('/api/admin/update-account', { method: 'POST', body: { action, targetId, role } })
      .then(() => openDashboardView(currentProfile?.account_type === 'administrator' && document.getElementById('organizationAccounts') ? 'organization_approvals' : 'staff_management'))
      .catch(error => { adminButton.disabled = false; window.alert(error.message); });
  });
  elements.dashboardContent.addEventListener('submit', event => {
    if (event.target.id === 'applicantInfoForm') {
      event.preventDefault();
      const form = event.target;
      if (!form.reportValidity()) return;
      setBusy(form, true);
      return void saveApplicantInformation(form).catch(error => { setBusy(form, false); window.alert(error.message); });
    }
    if (event.target.id === 'residencyForm') {
      event.preventDefault();
      const form = event.target;
      if (!form.reportValidity()) return;
      setBusy(form, true);
      return void saveResidency(form).catch(error => { setBusy(form, false); window.alert(error.message); });
    }
    if (event.target.id === 'householdMemberForm') {
      event.preventDefault();
      const form = event.target;
      if (!form.reportValidity()) return;
      setBusy(form, true);
      return void saveHouseholdMember(form).catch(error => { setBusy(form, false); window.alert(error.message); });
    }
    if (event.target.id === 'incomeSourceForm') {
      event.preventDefault();
      const form = event.target;
      if (!form.reportValidity()) return;
      setBusy(form, true);
      return void saveIncomeSource(form).catch(error => { setBusy(form, false); window.alert(error.message); });
    }
    if (event.target.id === 'resourceForm') {
      event.preventDefault(); const form = event.target; if (!form.reportValidity()) return; setBusy(form, true);
      return void saveResource(form).catch(error => { setBusy(form, false); window.alert(error.message); });
    }
    if (event.target.id === 'livingArrangementForm') {
      event.preventDefault(); const form = event.target; if (!form.reportValidity()) return; setBusy(form, true);
      return void saveLivingArrangement(form).catch(error => { setBusy(form, false); window.alert(error.message); });
    }
    if (event.target.id === 'healthCoverageForm') {
      event.preventDefault(); const form = event.target; if (!form.reportValidity()) return; setBusy(form, true);
      return void saveHealthCoverage(form).catch(error => { setBusy(form, false); window.alert(error.message); });
    }
    if (event.target.id === 'authorizedRepresentativeForm') {
      event.preventDefault(); const form = event.target; if (!form.reportValidity()) return; setBusy(form, true);
      return void saveAuthorizedRepresentative(form).catch(error => { setBusy(form, false); window.alert(error.message); });
    }
    if (event.target.id === 'reviewStatusForm') {
      event.preventDefault(); const form = event.target; if (!form.reportValidity()) return; const values = new FormData(form); setBusy(form, true);
      return void adminRequest('/api/intake/test-applications', { method: 'POST', body: { action: 'review_status', applicationId: form.dataset.applicationId, status: values.get('status') } })
        .then(() => renderApplicationReview(form.dataset.applicationId, 'Fictional review status updated.'))
        .catch(error => { setBusy(form, false); window.alert(error.message); });
    }
    if (event.target.id !== 'inviteStaffForm') return;
    event.preventDefault();
    const form = event.target;
    if (!form.reportValidity()) return;
    const values = new FormData(form);
    setBusy(form, true);
    adminRequest('/api/admin/invite-staff', { method: 'POST', body: { firstName: values.get('firstName'), lastName: values.get('lastName'), email: values.get('email'), role: values.get('role') } })
      .then(() => renderStaffManagement('The secure staff invitation was sent.'))
      .catch(error => { setBusy(form, false); window.alert(error.message); });
  });
  elements.dashboardContent.addEventListener('change', event => {
    if (event.target.id === 'mailingSame') {
      const fields = elements.dashboardContent.querySelector('[data-mailing-fields]');
      if (fields) fields.hidden = event.target.checked;
    }
  });
  document.getElementById('menuButton').addEventListener('click', () => elements.dashboard.classList.toggle('nav-open'));
  document.getElementById('signOutButton').addEventListener('click', async () => {
    await supabaseClient.auth.signOut({ scope: 'local' });
    currentUser = null;
    currentProfile = null;
    location.hash = 'signin';
    showAuthView('signin');
  });

  document.getElementById('signInForm').addEventListener('submit', async event => {
    event.preventDefault();
    const form = event.currentTarget;
    clearMessage('signin');
    if (!form.reportValidity()) return;
    setBusy(form, true);
    const values = new FormData(form);
    const { data, error } = await supabaseClient.auth.signInWithPassword({ email: values.get('email').trim(), password: values.get('password') });
    setBusy(form, false);
    if (error) return showMessage('signin', friendlyAuthError(error));
    await showDashboard(data.user);
  });

  document.getElementById('registerForm').addEventListener('submit', async event => {
    event.preventDefault();
    const form = event.currentTarget;
    clearMessage('register');
    if (!form.reportValidity()) return;
    const values = new FormData(form);
    const password = values.get('password');
    if (!validPassword(password)) return showMessage('register', 'Your password must contain at least 12 characters, upper- and lowercase letters, a number, and a symbol.');
    if (password !== values.get('confirmPassword')) return showMessage('register', 'The passwords do not match.');
    setBusy(form, true);
    const { data, error } = await supabaseClient.auth.signUp({
      email: values.get('email').trim(),
      password,
      options: {
        emailRedirectTo: `${location.origin}/app.html#signin`,
        data: {
          first_name: values.get('firstName').trim(),
          last_name: values.get('lastName').trim(),
          organization_name: values.get('organizationName').trim(),
          account_type: values.get('accountType'),
          terms_accepted: true,
          terms_version: '2026-07-16',
          privacy_version: '2026-07-16'
        }
      }
    });
    setBusy(form, false);
    if (error) return showMessage('register', friendlyAuthError(error));
    form.reset();
    syncOrganizationField();
    if (data.session) await showDashboard(data.user);
    else showMessage('register', 'Check your email to verify your address, then return here to sign in.', 'success');
  });

  document.getElementById('forgotForm').addEventListener('submit', async event => {
    event.preventDefault();
    const form = event.currentTarget;
    clearMessage('forgot');
    if (!form.reportValidity()) return;
    setBusy(form, true);
    const email = new FormData(form).get('email').trim();
    await supabaseClient.auth.resetPasswordForEmail(email, { redirectTo: `${location.origin}/app.html#reset` });
    setBusy(form, false);
    form.reset();
    showMessage('forgot', 'If an account matches that email address, reset instructions have been sent.', 'success');
  });

  document.getElementById('resetForm').addEventListener('submit', async event => {
    event.preventDefault();
    const form = event.currentTarget;
    clearMessage('reset');
    if (!form.reportValidity()) return;
    const values = new FormData(form);
    if (!validPassword(values.get('password'))) return showMessage('reset', 'Choose a password with at least 12 characters, upper- and lowercase letters, a number, and a symbol.');
    if (values.get('password') !== values.get('confirmPassword')) return showMessage('reset', 'The passwords do not match.');
    setBusy(form, true);
    const { error } = await supabaseClient.auth.updateUser({ password: values.get('password') });
    setBusy(form, false);
    if (error) return showMessage('reset', friendlyAuthError(error));
    showMessage('reset', 'Your password has been updated. You can now use the dashboard.', 'success');
    setTimeout(async () => {
      const { data } = await supabaseClient.auth.getUser();
      if (data.user) await showDashboard(data.user);
    }, 900);
  });
}

async function initialize() {
  showOnly('loading');
  const configuration = await loadConfiguration();
  if (!configuration) return showOnly('configuration');

  deploymentMode = configuration.deploymentMode || 'staging';
  intakeMode = configuration.intakeMode || (deploymentMode === 'production' ? 'official_guide' : 'fictional_test');

  supabaseClient = createClient(configuration.supabaseUrl, configuration.supabasePublishableKey, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
  });
  wireInterface();

  supabaseClient.auth.onAuthStateChange(async (event, session) => {
    if (event === 'PASSWORD_RECOVERY') {
      currentUser = session?.user || null;
      location.hash = 'reset';
      showAuthView('reset');
    }
  });

  const { data: { session } } = await supabaseClient.auth.getSession();
  if (session?.user && normalizeAuthView() !== 'reset') await showDashboard(session.user);
  else showAuthView();
}

initialize();
