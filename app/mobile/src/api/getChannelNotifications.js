import { checkResponse, fetchWithTimeout } from './fetchUtil';

export async function getChannelNotifications(server, token, channelId) {
  let insecure = /^(?!0)(?!.*\.$)((1?\d?\d|25[0-5]|2[0-4]\d)(\.|:\d+$|$)){4}$/.test(server);
  let protocol = insecure ? 'http' : 'https';
  let notify = await fetchWithTimeout(`${protocol}://${server}/content/channels/${channelId}/notification?agent=${token}`, { method: 'GET' });
  checkResponse(notify)
  return await notify.json()
}

