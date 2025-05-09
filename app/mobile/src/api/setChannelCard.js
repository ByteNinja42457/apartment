import { checkResponse, fetchWithTimeout } from './fetchUtil';

export async function setChannelCard(server, token, channelId, cardId ) {
  var insecure = /^(?!0)(?!.*\.$)((1?\d?\d|25[0-5]|2[0-4]\d)(\.|:\d+$|$)){4}$/.test(server);
  var protocol = insecure ? 'http' : 'https';

  let channel = await fetchWithTimeout(`${protocol}://${server}/content/channels/${channelId}/cards/${cardId}?agent=${token}`, {method: 'PUT'});
  checkResponse(channel);
  return await channel.json();
}
