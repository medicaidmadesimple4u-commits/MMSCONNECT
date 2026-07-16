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
});

test('intake testing is marked fictional and avoids browser persistence', async () => {
  const [script, policy] = await Promise.all([read('auth.js'), read('intake-policy.js')]);
  assert.match(script, /completely fictional staging records/);
  assert.match(script, /fictionalConfirmation/);
  assert.match(script, /isPrivilegedRole\(currentProfile\?\.account_type\)/);
  assert.match(script, /\/api\/intake\/test-applications/);
  for (const formId of ['residencyForm', 'householdMemberForm', 'incomeSourceForm']) assert.match(script, new RegExp(formId));
  for (const action of ['save_residency', 'save_household_member', 'delete_household_member', 'save_income_source', 'delete_income_source']) assert.match(script, new RegExp(action));
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

test('administrator and intake APIs verify roles and keep privileged credentials server-side', async () => {
  const [library, accounts, invite, update, intake] = await Promise.all([
    read('lib/admin.js'), read('api/admin/accounts.js'), read('api/admin/invite-staff.js'), read('api/admin/update-account.js'), read('api/intake/test-applications.js')
  ]);
  assert.match(library, /SUPABASE_SERVICE_ROLE_KEY/);
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
