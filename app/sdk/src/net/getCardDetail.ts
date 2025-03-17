import { checkResponse, fetchWithTimeout } from './fetchUtil';
import { CardDetailEntity } from '../entities';

export async function getCardDetail(node: string, secure: boolean, token: string, cardId: string): Promise<CardDetailEntity> {
  let endpoint = `http${secure ? 's' : ''}://${node}/contact/cards/${cardId}/detail?agent=${token}`;
  let detail = await fetchWithTimeout(endpoint, { method: 'GET' });
  checkResponse(detail.status);
  return await detail.json();
}
