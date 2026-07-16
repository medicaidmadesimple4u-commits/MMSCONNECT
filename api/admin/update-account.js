import { requestBody, requireAdministrator, requireAllowedOrigin, requireMethod, safeError, sendJson, serviceRequest, writeAudit } from '../../lib/admin.js';

const actions = new Set(['approve_organization', 'suspend_account', 'restore_account', 'set_role']);

export default async function handler(request, response) {
  if (!requireMethod(request, response, ['POST'])) return;
  if (!requireAllowedOrigin(request, response)) return;

  try {
    const administrator = await requireAdministrator(request);
    const body = requestBody(request);
    const targetId = String(body.targetId || '');
    const action = String(body.action || '');
    if (!targetId || !actions.has(action)) return sendJson(response, 400, { error: 'A valid account action is required.' });
    if (targetId === administrator.user.id) return sendJson(response, 400, { error: 'Use a separate administrator account to change your own access.' });

    const targets = await serviceRequest(`/rest/v1/profiles?select=id,organization_name,organization_id,account_type,status&id=eq.${encodeURIComponent(targetId)}&limit=1`);
    const target = targets?.[0];
    if (!target) return sendJson(response, 404, { error: 'The account could not be found.' });

    let changes;
    if (action === 'approve_organization') {
      if (!['agency', 'facility'].includes(target.account_type)) return sendJson(response, 400, { error: 'Only agency or facility accounts can be approved.' });
      changes = { status: 'active' };
    } else if (action === 'suspend_account') {
      changes = { status: 'suspended' };
    } else if (action === 'restore_account') {
      changes = { status: 'active' };
    } else {
      const role = String(body.role || '');
      if (!['staff', 'administrator'].includes(role)) return sendJson(response, 400, { error: 'Select Staff or Administrator.' });
      changes = { account_type: role, status: 'active' };
    }

    const updated = await serviceRequest(`/rest/v1/profiles?id=eq.${encodeURIComponent(targetId)}`, { method: 'PATCH', prefer: 'return=representation', body: changes });
    await writeAudit(administrator.user.id, targetId, action, { changes });
    return sendJson(response, 200, { account: updated?.[0] || { id: targetId, ...changes } });
  } catch (error) {
    return safeError(response, error);
  }
}
