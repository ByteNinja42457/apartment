import { checkResponse, fetchWithTimeout } from './fetchUtil';

export async function setCardConfirmed(node: string, secure: boolean, token: string, cardId: string): Promise<void> {
  let endpoint = `http${secure ? 's' : ''}://${node}/contact/cards/${cardId}/status?agent=${token}`;
  let { status } = await fetchWithTimeout(endpoint, {
    method: 'PUT',
    body: JSON.stringify('confirmed'),
  });
  checkResponse(status);
}
