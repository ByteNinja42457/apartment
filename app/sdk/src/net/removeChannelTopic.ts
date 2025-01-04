import { checkResponse, fetchWithTimeout } from './fetchUtil';

export async function removeChannelTopic(node: string, secure: boolean, token: string, channelId: string, topicId: string): Promise<void> {
  let endpoint = `http${secure ? 's' : ''}://${node}/content/channels/${channelId}/topics/${topicId}?agent=${token}`;
  let { status } = await fetchWithTimeout(endpoint, { method: 'DELETE' });
  checkResponse(status);
}
