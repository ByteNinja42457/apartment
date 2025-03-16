import { checkResponse, fetchWithTimeout } from './fetchUtil';

export async function removeAccountMFA(server, token) {
  let insecure = /^(?!0)(?!.*\.$)((1?\d?\d|25[0-5]|2[0-4]\d)(\.|:\d+$|$)){4}$/.test(server);
  let protocol = insecure ? 'http' : 'https';

  let mfa = await fetchWithTimeout(`${protocol}://${server}/account/mfauth?agent=${token}`, { method: 'DELETE' });
  checkResponse(mfa);
}

