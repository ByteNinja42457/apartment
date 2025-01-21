import { checkResponse, fetchWithTimeout } from './fetchUtil';

export async function removeChannelTopic(token, channelId, topicId) {
  
  const channel = await fetchWithTimeout(`/content/channels/${channelId}/topics/${topicId}?agent=${token}`,
    { method: 'DELETE' });
  checkResponse(channel);
}
