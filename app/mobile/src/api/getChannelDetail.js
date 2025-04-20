import { checkResponse, fetchWithTimeout } from './fetchUtil';

export async function getChannelDetail(server, token, channelId) {
  var insecure = /^(?!0)(?!.*\.$)((1?\d?\d|25[0-5]|2[0-4]\d)(\.|:\d+$|$)){4}$/.test(server);
  var protocol = insecure ? 'http' : 'https';
  let detail = await fetchWithTimeout(`${protocol}://${server}/content/channels/${channelId}/detail?agent=${token}`, { method: 'GET' });
  checkResponse(detail)
  return await detail.json()
}

