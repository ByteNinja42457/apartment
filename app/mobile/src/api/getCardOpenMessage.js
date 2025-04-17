import { checkResponse, fetchWithTimeout } from './fetchUtil';

export async function getCardOpenMessage(server, token, cardId) {
  var insecure = /^(?!0)(?!.*\.$)((1?\d?\d|25[0-5]|2[0-4]\d)(\.|:\d+$|$)){4}$/.test(server);
  var protocol = insecure ? 'http' : 'https';
  let message = await fetchWithTimeout(`${protocol}://${server}/contact/cards/${cardId}/openMessage?agent=${token}`, { method: 'GET' });
  checkResponse(message);
  return await message.json();
}

