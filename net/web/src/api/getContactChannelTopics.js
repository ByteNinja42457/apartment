import { checkResponse, fetchWithTimeout } from './fetchUtil';

export async function getContactChannelTopics(server, token, channelId, revision, count, begin, end) {
  const host = "";
  if (server) {
    host = `https://${server}`;
  }

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
  const topics = await fetchWithTimeout(`${host}/content/channels/${channelId}/topics?contact=${token}${rev}${cnt}${bgn}${edn}`, 
    { method: 'GET' });
  checkResponse(topics)
  return {
    marker: topics.headers.get('topic-marker'),
    revision: topics.headers.get('topic-revision'),
    topics: await topics.json(),
  }
}

