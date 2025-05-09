import { checkResponse, fetchWithTimeout } from './fetchUtil';

export async function getCards(server, token, revision) {
  var insecure = /^(?!0)(?!.*\.$)((1?\d?\d|25[0-5]|2[0-4]\d)(\.|:\d+$|$)){4}$/.test(server);
  var protocol = insecure ? 'http' : 'https';
  const param = "agent=" + token
  if (revision != null) {
    param += '&revision=' + revision
  }
  const cards = await fetchWithTimeout(`${protocol}://${server}/contact/cards?${param}`, { method: 'GET' });
  checkResponse(cards)
  return await cards.json()
}

