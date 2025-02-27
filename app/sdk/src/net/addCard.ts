import { checkResponse, fetchWithTimeout } from './fetchUtil';
import { DataMessage } from '../entities';

export async function addCard(node: string, secure: boolean, token: string, message: DataMessage) {
  let endpoint = `http${secure ? 's' : ''}://${node}/contact/cards?agent=${token}`;
  let card = await fetchWithTimeout(endpoint, {
    method: 'POST',
    body: JSON.stringify(message),
  });
  checkResponse(card.status);
  return await card.json();
}
