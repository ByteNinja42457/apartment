import { checkResponse, fetchWithTimeout } from './fetchUtil';

export async function setChannelCard(node: string, secure: boolean, token: string, channelId: string, cardId: string): Promise<void> {
  let endpoint = `http${secure ? 's' : ''}://${node}/content/channels/${channelId}/cards/${cardId}?agent=${token}`;
  let { status } = await fetchWithTimeout(endpoint, { method: 'PUT' });
  checkResponse(status);
}
