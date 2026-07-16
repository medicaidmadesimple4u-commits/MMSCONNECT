import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../', import.meta.url);
const read = path => readFile(new URL(path, root), 'utf8');

test('landing page links to real account routes', async () => {
  const html = await read('index.html');
  assert.match(html, /href="\/app\.html#signin"/);
  assert.match(html, /href="\/app\.html#register"/);
});

test('authentication page contains required account flows', async () => {
  const html = await read('app.html');
  for (const id of ['signInForm', 'registerForm', 'forgotForm', 'resetForm', 'dashboardShell']) {
    assert.match(html, new RegExp(`id="${id}"`));
  }
  assert.match(html, /value="client"/);
  assert.match(html, /value="authorized_representative"/);
  assert.match(html, /value="agency"/);
  assert.match(html, /value="facility"/);
  assert.match(html, /id="organizationName"/);
  assert.match(html, /href="\/terms\.html"/);
  assert.match(html, /href="\/privacy\.html"/);
  assert.doesNotMatch(html, /value="staff"/);
  assert.doesNotMatch(html, /value="administrator"/);
});

test('browser auth uses supported Supabase operations', async () => {
  const script = await read('auth.js');
  for (const operation of ['signInWithPassword', 'signUp', 'resetPasswordForEmail', 'updateUser', 'signOut']) {
    assert.match(script, new RegExp(operation));
  }
  assert.match(script, /MMS Connect Staff Portal/);
  assert.match(script, /organization_approvals/);
  assert.match(script, /staff_management/);
  assert.match(script, /renderApplications/);
  assert.match(script, /data-program-id/);
  assert.match(script, /\['applications', 'I', 'Intake Programs'\]/);
  assert.match(script, /else if \(view === 'applications'\) void renderApplications\(\)/);
  assert.doesNotMatch(script, /service[_-]?role/i);
  assert.match(script, /terms_accepted: true/);
  assert.match(script, /intakeMode === 'official_guide'/);
});

test('production exposes an official guide and disables fictional intake', async () => {
  const [config, script, intake, privacy, terms] = await Promise.all([
    read('api/config.js'), read('auth.js'), read('api/intake/test-applications.js'), read('privacy.html'), read('terms.html')
  ]);
  assert.match(config, /deploymentMode === 'production' \? 'official_guide' : 'fictional_test'/);
  assert.match(intake, /Test intake is not available in production/);
  assert.match(script, /Apply through ePASS/);
  assert.match(script, /Find county DSS/);
  assert.match(privacy, /This release does not accept Medicaid applications/);
  assert.match(terms, /No official application submission/);
});

test('policy-guided intake covers the principal NCDHHS pathways', async () => {
  const policy = await import(new URL('../intake-policy.js', import.meta.url));
  const expected = [
    'expansion_adult', 'infants_children', 'pregnancy', 'caretaker', 'former_foster',
    'family_planning', 'breast_cervical', 'aged_blind_disabled', 'medicare_savings',
    'working_disabled', 'long_term_care', 'cap', 'pace', 'innovations', 'tbi',
    'special_assistance_facility', 'special_assistance_in_home'
  ];
  assert.deepEqual(policy.medicaidPrograms.map(program => program.id), expected);
  for (const program of policy.medicaidPrograms) {
    assert.ok(program.manualRefs.length, `${program.id} needs a manual reference`);
    assert.ok(policy.getProgramSections(program.id).length >= 8, `${program.id} needs a complete intake map`);
    assert.ok(policy.getProgramSources(program.id).every(source => /^(https:\/\/medicaid\.ncdhhs\.gov|https:\/\/policies\.ncdhhs\.gov)/.test(source.url)));
  }
  assert.ok(policy.dssForms.length >= 7);
  assert.ok(policy.dssForms.every(form => /^https:\/\/(policies\.ncdhhs\.gov|www\.ncdhhs\.gov|epass\.nc\.gov)/.test(form.url)));
  for (const reference of ['MA-2230', 'DMA-5202-A', 'DHB-5202C-ia', 'DMA-5202D-ia', 'DHB-5202E-ia']) assert.match(policy.getPolicyReferenceUrl(reference), /^https:\/\//);
});

test('intake testing is marked fictional and avoids browser persistence', async () => {
  const [script, policy] = await Promise.all([read('auth.js'), read('intake-policy.js')]);
  assert.match(script, /completely fictional staging records/);
  assert.match(script, /fictionalConfirmation/);
  assert.match(script, /isPrivilegedRole\(currentProfile\?\.account_type\)/);
  assert.match(script, /\/api\/intake\/test-applications/);
  for (const formId of ['residencyForm', 'householdMemberForm', 'incomeSourceForm', 'resourceForm', 'livingArrangementForm', 'healthCoverageForm', 'authorizedRepresentativeForm', 'reviewStatusForm']) assert.match(script, new RegExp(formId));
  for (const action of ['save_residency', 'save_household_member', 'delete_household_member', 'save_income_source', 'delete_income_source', 'save_resource', 'delete_resource', 'save_living_arrangement', 'save_health_coverage', 'delete_health_coverage', 'save_authorized_representative', 'submit', 'review_status', 'reset', 'delete_application']) assert.match(script, new RegExp(action));
  assert.match(script, /policyReferenceLinks/);
  assert.match(script, /Official NC Medicaid and DSS forms/);
  assert.doesNotMatch(script, /\.from\(['"]applications['"]\)|\.from\(['"]application_applicants['"]\)/);
  assert.doesNotMatch(script, /localStorage|sessionStorage/);
  assert.doesNotMatch(policy, /\$\d|monthly_limit|resource_limit/i);
});

test('test intake schema enforces staging-only records and row-level access', async () => {
  const sql = await read('supabase/migrations/20260716174500_add_test_intake_foundation.sql');
  for (const table of ['applications', 'application_applicants', 'application_assignments', 'application_audit_log']) {
    assert.match(sql, new RegExp(`alter table public\\.${table} enable row level security`, 'i'));
  }
  assert.match(sql, /environment text not null default 'staging' check \(environment = 'staging'\)/i);
  assert.match(sql, /test_mode boolean not null default true check \(test_mode = true\)/i);
  assert.match(sql, /and public\.is_active_privileged_user\(\)/i);
  assert.match(sql, /created_by = \(select auth\.uid\(\)\)/i);
  assert.match(sql, /revoke all on public\.application_audit_log from anon, authenticated/i);
  assert.match(sql, /grant select, insert on public\.applications to authenticated/i);
  assert.doesNotMatch(sql, /grant[^;]*update[^;]*on public\.applications to authenticated/i);
});

test('household and income schema remains server-only and audited', async () => {
  const sql = await read('supabase/migrations/20260716193000_add_test_household_and_income.sql');
  for (const table of ['application_residency', 'application_household_members', 'application_income_sources']) {
    assert.match(sql, new RegExp(`create table if not exists public\\.${table}`, 'i'));
    assert.match(sql, new RegExp(`alter table public\\.${table} enable row level security`, 'i'));
    assert.match(sql, new RegExp(`revoke all on public\\.${table} from anon, authenticated`, 'i'));
    assert.doesNotMatch(sql, new RegExp(`grant[^;]+on public\\.${table} to authenticated`, 'i'));
  }
  for (const action of ['residency_saved', 'household_member_saved', 'household_member_removed', 'income_source_saved', 'income_source_removed']) assert.match(sql, new RegExp(action));
});

test('completed intake sections and review workflow remain server-only and audited', async () => {
  const [sql, script, api] = await Promise.all([
    read('supabase/migrations/20260716213000_complete_test_intake.sql'), read('auth.js'), read('api/intake/test-applications.js')
  ]);
  for (const table of ['application_resources', 'application_living_arrangements', 'application_health_coverage', 'application_authorized_representatives']) {
    assert.match(sql, new RegExp(`create table if not exists public\\.${table}`, 'i'));
    assert.match(sql, new RegExp(`alter table public\\.${table} enable row level security`, 'i'));
    assert.match(sql, new RegExp(`revoke all on public\\.${table} from anon, authenticated`, 'i'));
    assert.doesNotMatch(sql, new RegExp(`grant[^;]+on public\\.${table} to authenticated`, 'i'));
    assert.match(api, new RegExp(table));
  }
  for (const action of ['resource_saved', 'resource_removed', 'living_arrangement_saved', 'health_coverage_saved', 'health_coverage_removed', 'authorized_representative_saved', 'application_submitted', 'review_status_changed']) assert.match(sql, new RegExp(action));
  assert.match(api, /staff\.profile\.account_type !== 'administrator'/);
  assert.match(api, /details\.completion\.ready/);
  assert.match(script, /renderApplicationQueue/);
  assert.match(script, /This does not submit anything to NC Medicaid or a county DSS/);
});

test('fictional cases can be reset or deleted through the protected server endpoint', async () => {
  const [api, resetSql] = await Promise.all([
    read('api/intake/test-applications.js'), read('supabase/migrations/20260716230000_add_test_application_reset_audit.sql')
  ]);
  assert.match(api, /action === 'reset' \|\| action === 'delete_application'/);
  assert.match(api, /accessibleApplication\(staff, applicationId\)/);
  assert.match(api, /application_authorized_representatives/);
  assert.match(api, /application_applicants/);
  assert.match(api, /application_reset/);
  assert.match(resetSql, /application_reset/);
});

test('database schema enables RLS and prevents privileged self-registration', async () => {
  const sql = await read('supabase/schema.sql');
  assert.match(sql, /enable row level security/i);
  assert.match(sql, /requested_type is null or requested_type not in \('client', 'authorized_representative', 'agency', 'facility'\)/i);
  assert.match(sql, /case when requested_type in \('agency', 'facility'\) then 'pending' else 'active' end/i);
  assert.doesNotMatch(sql, /requested_type not in \([^)]*staff/i);
  assert.match(sql, /revoke update on table public\.profiles from authenticated/i);
  assert.match(sql, /grant update \(first_name, last_name, organization_name, phone\)/i);
  assert.match(sql, /create table if not exists public\.admin_audit_log/i);
  assert.match(sql, /alter table public\.admin_audit_log enable row level security/i);
  assert.match(sql, /revoke all on table public\.admin_audit_log from anon, authenticated/i);
});

test('new account consent is versioned and server-recorded', async () => {
  const sql = await read('supabase/migrations/20260716233000_record_account_terms_consent.sql');
  assert.match(sql, /create table if not exists public\.account_consents/i);
  assert.match(sql, /after insert on auth\.users/i);
  assert.match(sql, /terms_version/i);
  assert.match(sql, /privacy_version/i);
  assert.match(sql, /alter table public\.account_consents enable row level security/i);
  assert.match(sql, /revoke all on public\.account_consents from anon, authenticated/i);
});

test('referral network is closed-loop, role protected, and staging safe', async () => {
  const [script, api, config, sql] = await Promise.all([
    read('auth.js'), read('api/referrals.js'), read('api/config.js'), read('supabase/migrations/20260717001500_add_referral_network.sql')
  ]);
  assert.match(config, /referralMode/);
  assert.match(config, /MMS_REFERRALS_ENABLED/);
  assert.match(api, /requireReferralUser/);
  assert.match(api, /The referral network is not available in production yet/);
  assert.match(api, /body\.fictionalConfirmation !== true/);
  assert.match(api, /body\.consentConfirmed !== true/);
  for (const action of ['create', 'add_note', 'update_status']) assert.match(api, new RegExp(`action === '${action}'`));
  for (const status of ['sent', 'acknowledged', 'accepted', 'declined', 'in_progress', 'completed', 'closed', 'cancelled']) assert.match(api, new RegExp(status));
  for (const table of ['organizations', 'referrals', 'referral_events']) {
    assert.match(sql, new RegExp(`create table if not exists public\\.${table}`, 'i'));
    assert.match(sql, new RegExp(`alter table public\\.${table} enable row level security`, 'i'));
    assert.match(sql, new RegExp(`revoke all on table public\\.${table} from anon, authenticated`, 'i'));
  }
  assert.match(sql, /check \(sender_organization_id <> recipient_organization_id\)/i);
  assert.match(script, /renderReferralNetwork/);
  assert.match(script, /renderReferralDetail/);
  assert.match(script, /id="referralCreateForm"/);
  assert.match(script, /Fictional staging referrals only/);
  assert.doesNotMatch(script, /\.from\(['"]referrals['"]\)/);
});

test('intake captures additional needs and can create consented outbound referrals', async () => {
  const [script, intake, referrals, policy, sql] = await Promise.all([
    read('auth.js'), read('api/intake/test-applications.js'), read('api/referrals.js'), read('intake-policy.js'),
    read('supabase/migrations/20260717013000_add_intake_referral_needs.sql')
  ]);
  assert.match(policy, /Additional support and community referrals/);
  assert.match(script, /id="additionalSupportForm"/);
  assert.match(script, /Does this client need help with anything besides Medicaid/);
  assert.match(script, /id="intakeReferralForm"/);
  assert.match(script, /sourceApplicationId/);
  assert.match(intake, /action === 'save_referral_needs'/);
  assert.match(intake, /referralNeedRows/);
  assert.match(intake, /additionalSupport: Boolean/);
  assert.match(referrals, /Only MMS staff can create a referral from an intake record/);
  assert.match(referrals, /need\.referral_consent/);
  assert.match(referrals, /source_application_id/);
  assert.match(sql, /create table if not exists public\.application_referral_needs/i);
  assert.match(sql, /referral_consent boolean not null default false/i);
  assert.match(sql, /requested_services text\[\]/i);
  assert.match(sql, /alter table public\.application_referral_needs enable row level security/i);
  assert.match(sql, /revoke all on table public\.application_referral_needs from anon, authenticated/i);
});

test('staging includes fictional companies and a full referral simulator without shared accounts', async () => {
  const [script, api, sql] = await Promise.all([
    read('auth.js'), read('api/referrals.js'), read('supabase/migrations/20260717023000_seed_demo_referral_companies.sql')
  ]);
  for (const company of ['Helpful Llama Community Services', 'Golden Acorn Home Care', 'Pineapple Place Adult Day Center', 'Gentle Dragonfly Hospice', 'Paperwork Wizards Legal & Legacy Center', 'Bluebird Senior Living']) assert.match(sql, new RegExp(company.replace(/[&]/g, '\\&')));
  assert.match(sql, /test_mode boolean not null default false/i);
  assert.match(sql, /acting_organization_id/i);
  assert.doesNotMatch(sql, /auth\.users|password/i);
  assert.match(api, /action === 'create_demo_inbound'/);
  assert.match(api, /action === 'simulate_recipient_status'/);
  assert.match(api, /demo_recipient_status_changed/);
  assert.match(api, /environment=eq\.\$\{referralEnvironment\(\)\}/);
  assert.match(script, /id="demoInboundReferralForm"/);
  assert.match(script, /data-simulate-referral-status/);
  assert.match(script, /End-to-end test lab/);
});

test('administrator and intake APIs verify roles and keep privileged credentials server-side', async () => {
  const [library, accounts, invite, update, intake] = await Promise.all([
    read('lib/admin.js'), read('api/admin/accounts.js'), read('api/admin/invite-staff.js'), read('api/admin/update-account.js'), read('api/intake/test-applications.js')
  ]);
  assert.match(library, /SUPABASE_SERVICE_ROLE_KEY/);
  assert.match(library, /mms-connect-env-staging-mms-navigators\.vercel\.app/);
  assert.match(library, /profile\.account_type !== 'administrator'/);
  assert.match(accounts, /requireAdministrator/);
  assert.match(invite, /requireAllowedOrigin/);
  assert.match(invite, /writeAudit/);
  assert.match(update, /targetId === administrator\.user\.id/);
  assert.match(update, /writeAudit/);
  assert.match(library, /requirePrivilegedUser/);
  assert.match(intake, /requirePrivilegedUser/);
  assert.match(intake, /requireAllowedOrigin/);
  assert.match(intake, /confirmedFictional/);
  assert.match(intake, /serviceRequest\('\/rest\/v1\/applications'/);
  assert.match(intake, /application_residency/);
  assert.match(intake, /application_household_members/);
  assert.match(intake, /application_income_sources/);
  assert.match(intake, /application_resources/);
  assert.match(intake, /application_living_arrangements/);
  assert.match(intake, /application_health_coverage/);
  assert.match(intake, /application_authorized_representatives/);
  const browserScript = await read('auth.js');
  assert.doesNotMatch(browserScript, /SUPABASE_SERVICE_ROLE_KEY|service[_-]?role/i);
});

test('Vercel configuration applies baseline browser security headers', async () => {
  const config = JSON.parse(await read('vercel.json'));
  const headers = config.headers.flatMap(item => item.headers).map(item => item.key.toLowerCase());
  for (const required of ['content-security-policy', 'x-content-type-options', 'x-frame-options', 'referrer-policy', 'permissions-policy']) {
    assert.ok(headers.includes(required), `${required} header is missing`);
  }
});
