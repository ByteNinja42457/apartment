import { checkResponse, fetchWithTimeout } from './fetchUtil';

export async function getContactChannelNotifications(node: string, secure: boolean, guid: string, token: string, channelId: string): Promise<boolean> {
  let endpoint = `http${secure ? 's' : ''}://${node}/content/channels/${channelId}/notification?contact=${guid}.${token}`;
  let notify = await fetchWithTimeout(endpoint, { method: 'GET' });
  checkResponse(notify.status);
  return await notify.json();
}
