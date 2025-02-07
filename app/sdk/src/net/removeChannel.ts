import { checkResponse, fetchWithTimeout } from './fetchUtil';

export async function removeChannel(node: string, secure: boolean, token: string, channelId: string): Promise<void> {
  let endpoint = `http${secure ? 's' : ''}://${node}/content/channels/${channelId}?agent=${token}`;
  let { status } = await fetchWithTimeout(endpoint, { method: 'DELETE' });
  checkResponse(status);
}
