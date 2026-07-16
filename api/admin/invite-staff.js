import { requestBody, requireAdministrator, requireAllowedOrigin, requireMethod, safeError, sendJson, serviceRequest, writeAudit } from '../../lib/admin.js';

function validEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export default async function handler(request, response) {
  if (!requireMethod(request, response, ['POST'])) return;
  const origin = requireAllowedOrigin(request, response);
  if (!origin) return;

  try {
    const administrator = await requireAdministrator(request);
    const body = requestBody(request);
    const email = String(body.email || '').trim().toLowerCase();
    const firstName = String(body.firstName || '').trim().slice(0, 80);
    const lastName = String(body.lastName || '').trim().slice(0, 80);
    const role = String(body.role || 'staff');
    if (!validEmail(email) || !firstName || !lastName) return sendJson(response, 400, { error: 'Enter the staff member’s name and a valid email address.' });
    if (!['staff', 'administrator'].includes(role)) return sendJson(response, 400, { error: 'Select Staff or Administrator.' });

    const redirectTo = `${origin}/app.html#reset`;
    const invited = await serviceRequest(`/auth/v1/invite?redirect_to=${encodeURIComponent(redirectTo)}`, {
      method: 'POST',
      body: { email, data: { first_name: firstName, last_name: lastName, account_type: role } }
    });
    await serviceRequest(`/rest/v1/profiles?id=eq.${encodeURIComponent(invited.id)}`, { method: 'PATCH', prefer: 'return=minimal', body: { account_type: role, status: 'active' } });
    await writeAudit(administrator.user.id, invited.id, 'invite_staff', { email, role });
    return sendJson(response, 201, { account: { id: invited.id, email, first_name: firstName, last_name: lastName, account_type: role, status: 'active' } });
  } catch (error) {
    if (error?.status === 422 && /registered|exists/i.test(error.message)) error.status = 409;
    return safeError(response, error);
  }
}
