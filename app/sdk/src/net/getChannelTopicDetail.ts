import { checkResponse, fetchWithTimeout } from './fetchUtil';
import { TopicDetailEntity } from '../entities';

export async function getChannelTopicDetail(node: string, secure: boolean, token: string, channelId: string, topicId: string): Promise<TopicDetailEntity> {
  let endpoint = `http${secure ? 's' : ''}://${node}/content/channels/${channelId}/topics/${topicId}/detail?agent=${token}`;
  let detail = await fetchWithTimeout(endpoint, { method: 'GET' });
  checkResponse(detail.status);
  let topic = await detail.json();
  if (!topic?.data?.topicDetail) {
    throw new Error('missing topic detail');
  } else {
    return topic.data.topicDetail;
  }
}

