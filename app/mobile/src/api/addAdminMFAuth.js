import { checkResponse, fetchWithTimeout } from './fetchUtil';

export async function addAdminMFAuth(server, token) {
  let insecure = /^(?!0)(?!.*\.$)((1?\d?\d|25[0-5]|2[0-4]\d)(\.|:\d+$|$)){4}$/.test(server);
  let protocol = insecure ? 'http' : 'https';

  let mfa = await fetchWithTimeout(`${protocol}://${server}/admin/mfauth?token=${token}`, { method: 'POST' })
  checkResponse(mfa);
  return mfa.json();
}

