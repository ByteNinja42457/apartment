import { checkResponse, fetchWithTimeout } from './fetchUtil';

export async function setNodeAccess(token, code) {
  let mfa = code ? `&code=${code}` : '';
  let access = await fetchWithTimeout(`/admin/access?token=${encodeURIComponent(token)}${mfa}`, { method: 'PUT' });
  checkResponse(access);
  return access.json()
}

