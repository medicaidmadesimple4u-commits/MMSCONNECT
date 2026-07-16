import { requireAdministrator, requireMethod, safeError, sendJson, serviceRequest } from '../../lib/admin.js';

export default async function handler(request, response) {
  if (!requireMethod(request, response, ['GET'])) return;

  try {
    await requireAdministrator(request);
    const scope = String(request.query?.scope || 'all');
    const [profiles, userPage, audit] = await Promise.all([
      serviceRequest('/rest/v1/profiles?select=id,first_name,last_name,organization_name,account_type,status,created_at&order=created_at.desc'),
      serviceRequest('/auth/v1/admin/users?page=1&per_page=1000'),
      serviceRequest('/rest/v1/admin_audit_log?select=id,actor_id,target_id,action,details,created_at&order=created_at.desc&limit=25')
    ]);

    const usersById = new Map((userPage?.users || []).map(user => [user.id, user]));
    const accounts = (profiles || [])
      .filter(profile => {
        if (scope === 'staff') return ['staff', 'administrator'].includes(profile.account_type);
        if (scope === 'organization') return ['agency', 'facility'].includes(profile.account_type);
        return true;
      })
      .map(profile => {
        const user = usersById.get(profile.id);
        return { ...profile, email: user?.email || '', email_verified: Boolean(user?.email_confirmed_at) };
      });

    return sendJson(response, 200, { accounts, audit: audit || [] });
  } catch (error) {
    return safeError(response, error);
  }
}
