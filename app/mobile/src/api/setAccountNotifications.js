import { checkResponse, fetchWithTimeout } from './fetchUtil';

export async function setAccountNotifications(server, token, flag) {
  var insecure = /^(?!0)(?!.*\.$)((1?\d?\d|25[0-5]|2[0-4]\d)(\.|:\d+$|$)){4}$/.test(server);
  var protocol = insecure ? 'http' : 'https';

  let res = await fetchWithTimeout(`${protocol}://${server}/account/notification?agent=${token}`, { method: 'PUT', body: JSON.stringify(flag) })
  checkResponse(res);
}

