import { checkResponse, fetchWithTimeout } from './fetchUtil';
import { TopicEntity } from '../entities';

export async function getChannelTopics(node: string, secure: boolean, token: string, channelId: string, revision: number | null, count: number | null, begin: number | null, end: number | null): Promise<{marker: number, revision: number, topics: TopicEntity[]}> {
  let params = (revision ? `&revision=${revision}` : '') + (count ? `&count=${count}` : '') + (begin ? `&begin=${begin}` : '') + (end ? `&end=${end}` : '');
  let endpoint = `http${secure ? 's' : ''}://${node}/content/channels/${channelId}/topics?agent=${token}${params}`;
  let topics = await fetchWithTimeout(endpoint, { method: 'GET' });
  checkResponse(topics.status);
  return {
    marker: parseInt(topics.headers.get('topic-marker') || '0'),
    revision: parseInt(topics.headers.get('topic-revision') || '0'),
    topics: await topics.json(),
  }
}

