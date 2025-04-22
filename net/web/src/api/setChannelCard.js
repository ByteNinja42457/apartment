import { checkResponse, fetchWithTimeout } from './fetchUtil';

export async function setChannelCard(token, channelId, cardId ) {
  const channel = await fetchWithTimeout(`/content/channels/${channelId}/cards/${cardId}?agent=${token}`, {method: 'PUT'});
  checkResponse(channel);
  return await channel.json();
}
