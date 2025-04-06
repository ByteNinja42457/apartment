import { checkResponse, fetchWithTimeout } from './fetchUtil';

export async function removeCard(node: string, secure: boolean, token: string, cardId: string): Promise<void> {
  let endpoint = `http${secure ? 's' : ''}://${node}/contact/cards/${cardId}?agent=${token}`;
  let { status } = await fetchWithTimeout(endpoint, { method: 'DELETE' });
  checkResponse(status);
}
