import { checkResponse, fetchWithTimeout } from './fetchUtil';

export async function removeChannelTopic(server, token, channelId, topicId) {
  var insecure = /^(?!0)(?!.*\.$)((1?\d?\d|25[0-5]|2[0-4]\d)(\.|:\d+$|$)){4}$/.test(server);
  var protocol = insecure ? 'http' : 'https';
  
  let channel = await fetchWithTimeout(`${protocol}://${server}/content/channels/${channelId}/topics/${topicId}?agent=${token}`,
    { method: 'DELETE' });
  checkResponse(channel);
}
