import { checkResponse, fetchWithTimeout } from './fetchUtil';

export async function setCardOpenMessage(server, message) {
  const host = "";
  if (server) {
    host = `https://${server}`;
  }

  const status = await fetchWithTimeout(`${host}/contact/openMessage`, { method: 'PUT', body: JSON.stringify(message) });
  checkResponse(status);
  return await status.json();
}

