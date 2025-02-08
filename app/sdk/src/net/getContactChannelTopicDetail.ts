import { checkResponse, fetchWithTimeout } from './fetchUtil';
import { TopicDetailEntity } from '../entities';

export async function getContactChannelTopicDetail(node: string, secure: boolean, guidToken: string, channelId: string, topicId: string): Promise<TopicDetailEntity> {
  let endpoint = `http${secure ? 's' : ''}://${node}/content/channels/${channelId}/topics/${topicId}/detail?contact=${guidToken}`;
  let detail = await fetchWithTimeout(endpoint, { method: 'GET' });
  checkResponse(detail.status);
  let topic = await detail.json();
  if (!topic?.data?.topicDetail) {
    throw new Error('missing topic detail');
  } else {
    return topic.data.topicDetail;
  }
}
