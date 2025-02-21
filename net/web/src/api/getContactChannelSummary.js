import { checkResponse, fetchWithTimeout } from './fetchUtil';

export async function getContactChannelSummary(server, token, channelId) {
  const host = "";
  if (server) {
    host = `https://${server}`;
  }
  const summary = await fetchWithTimeout(`${host}/content/channels/${channelId}/summary?contact=${token}`, { method: 'GET' });
  checkResponse(summary)
  return await summary.json()
}

