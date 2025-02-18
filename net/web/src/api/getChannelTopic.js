import { checkResponse, fetchWithTimeout } from './fetchUtil';

export async function getChannelTopic(token, channelId, topicId) {
  const topic = await fetchWithTimeout(`/content/channels/${channelId}/topics/${topicId}/detail?agent=${token}`, 
    { method: 'GET' });
  checkResponse(topic)
  return await topic.json()
}

