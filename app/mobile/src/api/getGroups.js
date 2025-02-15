import { checkResponse, fetchWithTimeout } from './fetchUtil';

export async function getGroups(server, token, revision) {
  var insecure = /^(?!0)(?!.*\.$)((1?\d?\d|25[0-5]|2[0-4]\d)(\.|:\d+$|$)){4}$/.test(server);
  var protocol = insecure ? 'http' : 'https';

  const param = "agent=" + token
  if (revision != null) {
    param += '&revision=' + revision
  }
  const groups = await fetchWithTimeout(`${protocol}://server/alias/groups?${param}`, { method: 'GET' });
  checkResponse(groups)
  return await groups.json()
}


