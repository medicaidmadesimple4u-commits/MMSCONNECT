const allowedProductionOrigin = 'https://mms-connect.vercel.app';
const stagingOriginPattern = /^https:\/\/mms-connect-[a-z0-9]+-mms-navigators\.vercel\.app$/i;

export function sendJson(response, status, payload) {
  response.setHeader('Cache-Control', 'no-store, max-age=0');
  response.setHeader('Content-Type', 'application/json; charset=utf-8');
  return response.status(status).json(payload);
}

export function requireMethod(request, response, methods) {
  if (methods.includes(request.method)) return true;
  response.setHeader('Allow', methods.join(', '));
  sendJson(response, 405, { error: 'Method not allowed.' });
  return false;
}

export function requireAllowedOrigin(request, response) {
  const origin = request.headers.origin || '';
  if (origin === allowedProductionOrigin || stagingOriginPattern.test(origin)) return origin;
  sendJson(response, 403, { error: 'This request did not originate from MMS Connect.' });
  return null;
}

function configuration() {
  const url = process.env.SUPABASE_URL || '';
  const publishableKey = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY || '';
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  if (!url || !publishableKey || !serviceRoleKey) throw new Error('Administrator services are not configured.');
  return { url: url.replace(/\/$/, ''), publishableKey, serviceRoleKey };
}

async function parseResponse(response) {
  const text = await response.text();
  const data = text ? JSON.parse(text) : null;
  if (!response.ok) {
    const error = new Error(data?.msg || data?.message || data?.error_description || 'Supabase request failed.');
    error.status = response.status;
    throw error;
  }
  return data;
}

export async function serviceRequest(path, options = {}) {
  const { url, serviceRoleKey } = configuration();
  const response = await fetch(`${url}${path}`, {
    method: options.method || 'GET',
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      'Content-Type': 'application/json',
      ...(options.prefer ? { Prefer: options.prefer } : {})
    },
    body: options.body === undefined ? undefined : JSON.stringify(options.body)
  });
  return parseResponse(response);
}

async function requireSignedInProfile(request) {
  const authorization = request.headers.authorization || '';
  const accessToken = authorization.startsWith('Bearer ') ? authorization.slice(7).trim() : '';
  if (!accessToken) {
    const error = new Error('Sign in is required.');
    error.status = 401;
    throw error;
  }

  const { url, publishableKey } = configuration();
  const userResponse = await fetch(`${url}/auth/v1/user`, {
    headers: { apikey: publishableKey, Authorization: `Bearer ${accessToken}` }
  });
  const user = await parseResponse(userResponse);
  const profiles = await serviceRequest(`/rest/v1/profiles?select=id,first_name,last_name,account_type,status&id=eq.${encodeURIComponent(user.id)}&limit=1`);
  const profile = profiles?.[0];
  if (!profile || profile.status !== 'active') {
    const error = new Error('This account is not active.');
    error.status = 403;
    throw error;
  }
  return { user, profile };
}

export async function requirePrivilegedUser(request) {
  const context = await requireSignedInProfile(request);
  if (!['staff', 'administrator'].includes(context.profile.account_type)) {
    const error = new Error('MMS staff access is required.');
    error.status = 403;
    throw error;
  }
  return context;
}

export async function requireAdministrator(request) {
  const context = await requireSignedInProfile(request);
  const profile = context.profile;
  if (profile.account_type !== 'administrator') {
    const error = new Error('Administrator access is required.');
    error.status = 403;
    throw error;
  }
  return context;
}

export function requestBody(request) {
  if (!request.body) return {};
  if (typeof request.body === 'string') return JSON.parse(request.body);
  return request.body;
}

export async function writeAudit(actorId, targetId, action, details = {}) {
  await serviceRequest('/rest/v1/admin_audit_log', {
    method: 'POST',
    prefer: 'return=minimal',
    body: { actor_id: actorId, target_id: targetId || null, action, details }
  });
}

export function safeError(response, error) {
  const status = Number.isInteger(error?.status) && error.status >= 400 && error.status < 600 ? error.status : 500;
  const publicMessage = status < 500 ? error.message : 'The administrator request could not be completed.';
  return sendJson(response, status, { error: publicMessage });
}
