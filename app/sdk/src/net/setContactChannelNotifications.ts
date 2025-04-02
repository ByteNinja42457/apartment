import { checkResponse, fetchWithTimeout } from './fetchUtil';

export async function setContactChannelNotifications(node: string, secure: boolean, guid: string, token: string, channelId: string, enabled: boolean) {
  let endpoint = `http${secure ? 's' : ''}://${node}/content/channels/${channelId}/notification?contact=${guid}.${token}`;
  let notify = await fetchWithTimeout(endpoint, { method: 'PUT', body: JSON.stringify(enabled) });
  checkResponse(notify.status);
}
