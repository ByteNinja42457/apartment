import { checkResponse, fetchWithTimeout } from './fetchUtil';

export async function removeContactChannelTopic(node: string, secure: boolean, guidToken: string, channelId: string, topicId: string) {
  let endpoint = `http${secure ? 's' : ''}://${node}/content/channels/${channelId}/topics/${topicId}?contact=${guidToken}`;
  let response = await fetchWithTimeout(endpoint, { method: 'DELETE' });
  checkResponse(response.status);
}
