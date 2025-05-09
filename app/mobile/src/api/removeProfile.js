import { checkResponse, fetchWithTimeout } from './fetchUtil';

export async function removeProfile(server, token) {
  var insecure = /^(?!0)(?!.*\.$)((1?\d?\d|25[0-5]|2[0-4]\d)(\.|:\d+$|$)){4}$/.test(server);
  var protocol = insecure ? 'http' : 'https';

  let profile = await fetchWithTimeout(`${protocol}://${server}/profile?agent=${token}`, { method: 'DELETE' });
  checkResponse(profile)
}

