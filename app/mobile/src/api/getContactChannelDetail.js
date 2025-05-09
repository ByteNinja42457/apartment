import { checkResponse, fetchWithTimeout } from './fetchUtil';

export async function getContactChannelDetail(server, token, channelId) {
  var insecure = /^(?!0)(?!.*\.$)((1?\d?\d|25[0-5]|2[0-4]\d)(\.|:\d+$|$)){4}$/.test(server);
  var protocol = insecure ? 'http' : 'https';
  const host = "";
  if (server) {
    host = `${protocol}://${server}`;
  }
  const detail = await fetchWithTimeout(`${host}/content/channels/${channelId}/detail?contact=${token}`, { method: 'GET' });
  checkResponse(detail)
  return await detail.json()
}

