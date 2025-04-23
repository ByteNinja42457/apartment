import { checkResponse, fetchWithTimeout } from './fetchUtil';
import { DataMessage } from '../entities';

export async function getCardCloseMessage(node: string, secure: boolean, token: string, cardId: string): Promise<DataMessage> {
  let endpoint = `http${secure ? 's' : ''}://${node}/contact/cards/${cardId}/closeMessage?agent=${token}`;
  let close = await fetchWithTimeout(endpoint, { method: 'GET' });
  checkResponse(close.status);
  return await close.json();
}
