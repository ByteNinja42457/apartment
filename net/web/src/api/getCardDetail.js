import { checkResponse, fetchWithTimeout } from './fetchUtil';

export async function getCardDetail(token, cardId) {
  const param = "?agent=" + token
  const detail = await fetchWithTimeout(`/contact/cards/${cardId}/detail${param}`, { method: 'GET' });
  checkResponse(detail);
  return await detail.json()
}

