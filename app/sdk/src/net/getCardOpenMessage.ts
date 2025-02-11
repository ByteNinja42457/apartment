import { checkResponse, fetchWithTimeout } from './fetchUtil';
import { DataMessage } from '../entities';

export async function getCardOpenMessage(node: string, secure: boolean, token: string, cardId: string): Promise<DataMessage> {
  let endpoint = `http${secure ? 's' : ''}://${node}/contact/cards/${cardId}/openMessage?agent=${token}`;
  let open = await fetchWithTimeout(endpoint, { method: 'GET' });
  checkResponse(open.status);
  return await open.json();
}
