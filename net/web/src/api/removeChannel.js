import { checkResponse, fetchWithTimeout } from './fetchUtil';

export async function removeChannel(token, channelId) {
  
  const channel = await fetchWithTimeout(`/content/channels/${channelId}?agent=${token}`,
    { method: 'DELETE' });
  checkResponse(channel);
}
