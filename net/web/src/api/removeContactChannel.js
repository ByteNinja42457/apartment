import { checkResponse, fetchWithTimeout } from './fetchUtil';

export async function removeContactChannel(server, token, channelId) {
  const host = "";
  if (server) {
    host = `https://${server}`;
  }
  
  const channel = await fetchWithTimeout(`${host}/content/channels/${channelId}?contact=${token}`,
    { method: 'DELETE' });
  checkResponse(channel);
}
