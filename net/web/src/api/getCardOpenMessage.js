import { checkResponse, fetchWithTimeout } from './fetchUtil';

export async function getCardOpenMessage(token, cardId) {
  const message = await fetchWithTimeout(`/contact/cards/${cardId}/openMessage?agent=${token}`, { method: 'GET' });
  checkResponse(message);
  return await message.json();
}

