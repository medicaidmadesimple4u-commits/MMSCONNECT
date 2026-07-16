import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.110.1/+esm';

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
    description: 'Your Medicaid applications and progress will appear here after secure intake is enabled.',
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
    if (button) openDashboardView(button.dataset.openView);
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
