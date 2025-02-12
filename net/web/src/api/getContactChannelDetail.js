import { checkResponse, fetchWithTimeout } from './fetchUtil';

export async function getContactChannelDetail(server, token, channelId) {
  const host = "";
  if (server) {
    host = `https://${server}`;
  }
  const detail = await fetchWithTimeout(`${host}/content/channels/${channelId}/detail?contact=${token}`, { method: 'GET' });
  checkResponse(detail)
  return await detail.json()
}

