import { checkResponse, fetchWithTimeout } from './fetchUtil';

export async function setAccountSeal(server, token, seal) {
  var insecure = /^(?!0)(?!.*\.$)((1?\d?\d|25[0-5]|2[0-4]\d)(\.|:\d+$|$)){4}$/.test(server);
  var protocol = insecure ? 'http' : 'https';

  let res = await fetchWithTimeout(`${protocol}://${server}/account/seal?agent=${token}`, { method: 'PUT', body: JSON.stringify(seal) })
  checkResponse(res);
}

