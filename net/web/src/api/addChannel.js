import { checkResponse, fetchWithTimeout } from './fetchUtil';

export async function addChannel(token, type, cards, data ) {
  const params = { dataType: type, data: JSON.stringify(data), groups: [], cards };
  const channel = await fetchWithTimeout(`/content/channels?agent=${token}`, { method: 'POST', body: JSON.stringify(params)} );
  checkResponse(channel);
  return await channel.json();
}

