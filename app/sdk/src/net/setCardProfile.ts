import { checkResponse, fetchWithTimeout } from './fetchUtil';
import { DataMessage } from '../entities';

export async function setCardProfile(node: string, secure: boolean, token: string, cardId: string, data: DataMessage): Promise<void> {
  let endpoint = `http${secure ? 's' : ''}://${node}/contact/cards/${cardId}/profile?agent=${token}`;
  let { status } = await fetchWithTimeout(endpoint, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
  checkResponse(status);
}
