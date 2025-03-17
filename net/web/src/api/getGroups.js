import { checkResponse, fetchWithTimeout } from './fetchUtil';

export async function getGroups(token, revision) {
  const param = "agent=" + token
  if (revision != null) {
    param += '&revision=' + revision
  }
  const groups = await fetchWithTimeout(`/alias/groups?${param}`, { method: 'GET' });
  checkResponse(groups)
  return await groups.json()
}


