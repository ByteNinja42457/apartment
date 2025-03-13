import { checkResponse, fetchWithTimeout } from './fetchUtil';

export async function setContactChannelTopicSubject(server, token, channelId, topicId, datatype, data) {
  const host = "";
  if (server) {
    host = `https://${server}`;
  }

  const subject = { data: JSON.stringify(data, (key, value) => {
    if (value !== null) return value
  }), datatype };

  const channel = await fetchWithTimeout(`${host}/content/channels/${channelId}/topics/${topicId}/subject?contact=${token}&confirm=true`,
    { method: 'PUT', body: JSON.stringify(subject) });
  checkResponse(channel);
}
