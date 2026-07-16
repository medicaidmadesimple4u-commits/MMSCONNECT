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
  assert.doesNotMatch(html, /value="administrator"/);
});

test('browser auth uses supported Supabase operations', async () => {
  const script = await read('auth.js');
  for (const operation of ['signInWithPassword', 'signUp', 'resetPasswordForEmail', 'updateUser', 'signOut']) {
    assert.match(script, new RegExp(operation));
  }
  assert.doesNotMatch(script, /service[_-]?role/i);
});

test('database schema enables RLS and prevents privileged self-registration', async () => {
  const sql = await read('supabase/schema.sql');
  assert.match(sql, /enable row level security/i);
  assert.match(sql, /requested_type is null or requested_type not in \('client', 'authorized_representative'\)/i);
  assert.match(sql, /revoke update on table public\.profiles from authenticated/i);
  assert.match(sql, /grant update \(first_name, last_name, phone\)/i);
});

test('Vercel configuration applies baseline browser security headers', async () => {
  const config = JSON.parse(await read('vercel.json'));
  const headers = config.headers.flatMap(item => item.headers).map(item => item.key.toLowerCase());
  for (const required of ['content-security-policy', 'x-content-type-options', 'x-frame-options', 'referrer-policy', 'permissions-policy']) {
    assert.ok(headers.includes(required), `${required} header is missing`);
  }
});
