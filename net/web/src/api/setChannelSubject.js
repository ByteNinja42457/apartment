import { checkResponse, fetchWithTimeout } from './fetchUtil';

export async function setChannelSubject(token, channelId, dataType, data ) {
  const params = { dataType, data: JSON.stringify(data) };
  const channel = await fetchWithTimeout(`/content/channels/${channelId}/subject?agent=${token}`, { method: 'PUT', body: JSON.stringify(params)} );
  checkResponse(channel);
  return await channel.json();
}
