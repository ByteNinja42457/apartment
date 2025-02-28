import { checkResponse, fetchWithTimeout } from './fetchUtil';

export async function getChannelTopics(token, channelId, revision, count, begin, end) {
  const rev = ''
  if (revision != null) {
    rev = `&revision=${revision}`
  }
  const cnt = ''
  if (count != null) {
    cnt = `&count=${count}`
  }
  const bgn = ''
  if (begin != null) {
    bgn = `&begin=${begin}`
  }
  const edn = ''
  if (end != null) {
    edn = `&end=${end}`
  }
  const topics = await fetchWithTimeout(`/content/channels/${channelId}/topics?agent=${token}${rev}${cnt}${bgn}${edn}`, 
    { method: 'GET' });
  checkResponse(topics)
  return { 
    marker: topics.headers.get('topic-marker'),
    revision: topics.headers.get('topic-revision'),
    topics: await topics.json(),
  }
}

