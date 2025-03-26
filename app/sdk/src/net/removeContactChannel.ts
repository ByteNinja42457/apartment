import { checkResponse, fetchWithTimeout } from './fetchUtil';

export async function removeContactChannel(node: string, secure: boolean, guid: string, token: string, channelId: string) {
  let endpoint = `http${secure ? 's' : ''}://${node}/content/channels/${channelId}?contact=${guid}.${token}`;
  let response = await fetchWithTimeout(endpoint, { method: 'DELETE' });
  checkResponse(response.status);
}
