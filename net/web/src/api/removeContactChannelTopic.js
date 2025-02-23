import { checkResponse, fetchWithTimeout } from './fetchUtil';

export async function removeContactChannelTopic(server, token, channelId, topicId) {
  const host = "";
  if (server) {
    host = `https://${server}`;
  }

  const channel = await fetchWithTimeout(`${host}/content/channels/${channelId}/topics/${topicId}?contact=${token}`,
    { method: 'DELETE' });
  checkResponse(channel);
}
