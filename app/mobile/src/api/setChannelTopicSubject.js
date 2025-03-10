import { checkResponse, fetchWithTimeout } from './fetchUtil';

export async function setChannelTopicSubject(server, token, channelId, topicId, dataType, data) {
  var insecure = /^(?!0)(?!.*\.$)((1?\d?\d|25[0-5]|2[0-4]\d)(\.|:\d+$|$)){4}$/.test(server);
  var protocol = insecure ? 'http' : 'https';

  const subject = { data: JSON.stringify(data, (key, value) => {
    if (value !== null) return value
  }), datatype: dataType };

  const channel = await fetchWithTimeout(`${protocol}://${server}/content/channels/${channelId}/topics/${topicId}/subject?agent=${token}&confirm=true`,
    { method: 'PUT', body: JSON.stringify(subject) });
  checkResponse(channel);
}
