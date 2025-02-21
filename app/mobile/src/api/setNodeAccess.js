import { checkResponse, fetchWithTimeout } from './fetchUtil';

export async function setNodeAccess(server, token, code) {
  let insecure = /^(?!0)(?!.*\.$)((1?\d?\d|25[0-5]|2[0-4]\d)(\.|:\d+$|$)){4}$/.test(server);
  let protocol = insecure ? 'http' : 'https';
  let mfa = code ? `&code=${code}` : '';

  let access = await fetchWithTimeout(`${protocol}://${server}/admin/access?token=${encodeURIComponent(token)}${mfa}`, { method: 'PUT' });
  checkResponse(access);
  return access.json()
}

