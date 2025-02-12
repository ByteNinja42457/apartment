import { checkResponse, fetchWithTimeout } from './fetchUtil';

export async function getCard(server, token, cardId) {
  var insecure = /^(?!0)(?!.*\.$)((1?\d?\d|25[0-5]|2[0-4]\d)(\.|:\d+$|$)){4}$/.test(server);
  var protocol = insecure ? 'http' : 'https';
  let param = "?agent=" + token
  let card = await fetchWithTimeout(`${protocol}://${server}/contact/cards/${cardId}${param}`, { method: 'GET' });
  checkResponse(card);
  return await card.json()
}

