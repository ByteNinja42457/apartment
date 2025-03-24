import { checkResponse, fetchWithTimeout } from './fetchUtil';

export async function clearChannelCard(token, channelId, cardId ) {
  const channel = await fetchWithTimeout(`/content/channels/${channelId}/cards/${cardId}?agent=${token}`, {method: 'DELETE'});
  checkResponse(channel);
  return await channel.json();
}
