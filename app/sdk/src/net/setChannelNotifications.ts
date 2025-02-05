import { checkResponse, fetchWithTimeout } from './fetchUtil';

export async function setChannelNotifications(node: string, secure: boolean, token: string, channelId: string, notify: boolean) {
  let endpoint = `http${secure ? 's' : ''}://${node}/content/channels/${channelId}/notification?agent=${token}`;
  let { status } = await fetchWithTimeout(endpoint, { method: 'PUT', body: JSON.stringify(notify) });
  checkResponse(status);
}
