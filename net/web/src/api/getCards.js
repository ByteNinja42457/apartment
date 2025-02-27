import { checkResponse, fetchWithTimeout } from './fetchUtil';

export async function getCards(token, revision) {
  const param = "agent=" + token
  if (revision != null) {
    param += '&revision=' + revision
  }
  const cards = await fetchWithTimeout(`/contact/cards?${param}`, { method: 'GET' });
  checkResponse(cards)
  return await cards.json()
}

