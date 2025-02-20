import { checkResponse, fetchWithTimeout } from './fetchUtil';

export async function setCardCloseMessage(server, message) {
  const host = "";
  if (server) {
    host = `https://${server}`;
  }

  const status = await fetchWithTimeout(`${host}/contact/closeMessage`, { method: 'PUT', body: JSON.stringify(message) });
  checkResponse(status);
  return await status.json();
}

