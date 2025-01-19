import { checkResponse, fetchWithTimeout } from './fetchUtil';

export async function getCardProfile(token, cardId) {
  const profile = await fetchWithTimeout(`/contact/cards/${cardId}/profile?agent=${token}`, { method: 'GET' });
  checkResponse(profile);
  return await profile.json()
}

