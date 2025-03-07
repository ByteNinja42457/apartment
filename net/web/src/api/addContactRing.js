import { checkResponse, fetchWithTimeout } from './fetchUtil';

export async function addContactRing(server, token, call) {
  const host = "";
  if (server) {
    host = `https://${server}`
  }

  const ring = await fetchWithTimeout(`${host}/talk/rings?contact=${token}`, { method: 'POST', body: JSON.stringify(call) });
  checkResponse(ring);
}

