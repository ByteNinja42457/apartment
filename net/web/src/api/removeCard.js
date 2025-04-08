import { checkResponse, fetchWithTimeout } from './fetchUtil';

export async function removeCard(token, cardId) {
  const card = await fetchWithTimeout(`/contact/cards/${cardId}?agent=${token}`, { method: 'DELETE' } );
  checkResponse(card);
  return await card.json();
}

