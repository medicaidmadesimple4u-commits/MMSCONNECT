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
    .select('id, first_name, last_name, account_type, status, created_at')
    .eq('id', user.id)
    .maybeSingle();

  if (!error && data) return data;
  return {
    id: user.id,
    first_name: user.user_metadata?.first_name || '',
    last_name: user.user_metadata?.last_name || '',
    account_type: user.user_metadata?.account_type || 'client',
    status: 'active',
    created_at: user.created_at
  };
}

function roleLabel(role) {
  return ({
    client: 'Client',
    authorized_representative: 'Authorized Representative',
    staff: 'MMS Staff',
    administrator: 'Administrator'
  })[role] || 'Client';
}

function getDisplayName() {
  const name = `${currentProfile?.first_name || ''} ${currentProfile?.last_name || ''}`.trim();
  return name || currentUser?.email || 'MMS Connect User';
}

function renderHome() {
  const firstName = currentProfile?.first_name || 'there';
  elements.headerViewName.textContent = 'Home';
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

  if (currentProfile?.status && currentProfile.status !== 'active') {
    await supabaseClient.auth.signOut({ scope: 'local' });
    showAuthView('signin');
    showMessage('signin', 'This account is not active. Contact MMS Connect support for assistance.');
    return;
  }

  const displayName = getDisplayName();
  elements.accountName.textContent = displayName;
  elements.accountRole.textContent = roleLabel(currentProfile?.account_type);
  elements.accountInitials.textContent = displayName.split(/\s+/).slice(0, 2).map(part => part[0]).join('').toUpperCase();
  showOnly('dashboard');
  openDashboardView('home');
}

function wireInterface() {
  document.querySelectorAll('[data-current-year]').forEach(node => { node.textContent = new Date().getFullYear(); });

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

  document.querySelectorAll('[data-dashboard-view]').forEach(button => button.addEventListener('click', () => openDashboardView(button.dataset.dashboardView)));
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
          account_type: values.get('accountType')
        }
      }
    });
    setBusy(form, false);
    if (error) return showMessage('register', friendlyAuthError(error));
    form.reset();
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
