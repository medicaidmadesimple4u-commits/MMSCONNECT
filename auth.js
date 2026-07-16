import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.110.1/+esm';
import { getProgram, getProgramSections, getProgramSources, medicaidPrograms, policyRelease } from './intake-policy.js';

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

async function loadOwnedTestApplications() {
  if (!isPrivilegedRole(currentProfile?.account_type)) return [];
  const { data, error } = await supabaseClient
    .from('applications')
    .select('id, program_id, status, policy_version, created_at, updated_at')
    .eq('owner_id', currentUser.id)
    .eq('environment', 'staging')
    .eq('test_mode', true)
    .order('updated_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

function renderTestApplicationList(applications) {
  if (!applications.length) return '<p class="admin-empty">No fictional test applications have been started.</p>';
  return `<div class="test-application-list">${applications.map(application => `<article><div><strong>${escapeHtml(programTitle(application.program_id))}</strong><span>${escapeHtml(application.status.replaceAll('_', ' '))} · Policy ${escapeHtml(application.policy_version)}</span></div><button type="button" data-resume-test-application="${escapeHtml(application.id)}">Resume test</button></article>`).join('')}</div>`;
}

async function renderApplications(selectedProgramId = '', notice = '') {
  elements.headerViewName.textContent = 'Applications';
  const groups = [...new Set(medicaidPrograms.map(program => program.group))];
  const selected = getProgram(selectedProgramId);
  const checklist = selected ? getProgramSections(selected.id) : [];
  const sources = selected ? getProgramSources(selected.id) : [];
  const canRunTest = isPrivilegedRole(currentProfile?.account_type);
  let testApplications = [];
  let testLoadError = '';
  if (canRunTest) {
    try { testApplications = await loadOwnedTestApplications(); }
    catch { testLoadError = 'The protected test-intake database is not available yet.'; }
  }

  elements.dashboardContent.innerHTML = `
    <section class="content-heading">
      <p class="eyebrow">NCDHHS policy guide</p>
      <h1>Choose an intake pathway</h1>
      <p>This preview maps each NC Medicaid pathway to the information MMS Connect will organize. It does not determine eligibility or submit an application to the State.</p>
    </section>
    ${notice ? `<div class="form-message success">${escapeHtml(notice)}</div>` : ''}
    <div class="safety-banner"><span aria-hidden="true">!</span><div><strong>Preview with test scenarios only.</strong><p>Public intake remains disabled. Only active MMS staff and administrators may save completely fictional staging records for security testing.</p></div></div>
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
              <small>Policy: ${escapeHtml(program.manualRefs.join(', '))}</small>
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
          ${checklist.map((section, index) => `<li><span>${index + 1}</span><div><h3>${escapeHtml(section.title)}</h3><p>${escapeHtml(section.summary)}</p><small>${escapeHtml(section.policy.join(' · '))}</small></div></li>`).join('')}
        </ol>
        ${canRunTest ? `<div class="intake-test-action"><div><strong>Test the first protected screen</strong><p>Create a staging-only draft and use fictional information to test save and resume.</p></div><button class="button primary" type="button" data-start-test-application="${escapeHtml(selected.id)}">Start fictional test</button></div>` : ''}
        <div class="policy-sources"><h3>Official NCDHHS sources</h3><ul>${sources.map(source => `<li><a href="${escapeHtml(source.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(source.title)}</a></li>`).join('')}</ul><p>Income and resource standards change. MMS Connect will reference the current NCDHHS tables instead of treating a displayed amount as an eligibility decision.</p></div>
      </section>` : ''}`;

  if (selected) document.getElementById('intakeMap')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

async function startTestApplication(programId) {
  const program = getProgram(programId);
  if (!program || !isPrivilegedRole(currentProfile?.account_type)) throw new Error('This test pathway is not available.');
  const { data, error } = await supabaseClient.from('applications').insert({
    owner_id: currentUser.id,
    program_id: program.id,
    status: 'draft',
    policy_version: policyRelease.version,
    environment: 'staging',
    test_mode: true
  }).select('id').single();
  if (error) throw error;
  await renderApplicantInformation(data.id);
}

async function renderApplicantInformation(applicationId, notice = '') {
  elements.headerViewName.textContent = 'Applicant Information';
  const { data: application, error: applicationError } = await supabaseClient
    .from('applications')
    .select('id, program_id, status, policy_version, environment, test_mode')
    .eq('id', applicationId)
    .single();
  if (applicationError || !application?.test_mode || application.environment !== 'staging') throw new Error('The test application could not be opened.');

  const { data: applicant, error: applicantError } = await supabaseClient
    .from('application_applicants')
    .select('legal_first_name, legal_middle_name, legal_last_name, preferred_name, date_of_birth, contact_email, phone, preferred_language, nc_county, applying_for_coverage')
    .eq('application_id', application.id)
    .eq('person_order', 1)
    .maybeSingle();
  if (applicantError) throw applicantError;

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
        <div class="intake-form-actions"><button class="button secondary" type="button" data-back-intake-programs>Back to intake programs</button><button class="button primary" type="submit">Save test information</button></div>
      </form>
    </section>`;
}

async function saveApplicantInformation(form) {
  const values = new FormData(form);
  const applicationId = form.dataset.applicationId;
  const payload = {
    application_id: applicationId,
    person_order: 1,
    legal_first_name: values.get('legalFirstName').trim(),
    legal_middle_name: values.get('legalMiddleName').trim() || null,
    legal_last_name: values.get('legalLastName').trim(),
    preferred_name: values.get('preferredName').trim() || null,
    date_of_birth: values.get('dateOfBirth'),
    contact_email: values.get('contactEmail').trim() || null,
    phone: values.get('phone').trim() || null,
    preferred_language: values.get('preferredLanguage').trim(),
    nc_county: values.get('ncCounty').trim() || null,
    applying_for_coverage: values.get('applyingForCoverage') === 'true',
    created_by: currentUser.id
  };
  const { error } = await supabaseClient.from('application_applicants').upsert(payload, { onConflict: 'application_id,person_order' });
  if (error) throw error;
  await renderApplicantInformation(applicationId, 'Fictional applicant information saved. The audit history was updated.');
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
    if (event.target.closest('[data-back-intake-programs]')) return void renderApplications();
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
          account_type: values.get('accountType')
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
