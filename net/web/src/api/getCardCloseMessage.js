import { checkResponse, fetchWithTimeout } from './fetchUtil';

export async function getCardCloseMessage(token, cardId) {
  const message = await fetchWithTimeout(`/contact/cards/${cardId}/closeMessage?agent=${token}`, { method: 'GET' });
  checkResponse(message);
  return await message.json();
}

