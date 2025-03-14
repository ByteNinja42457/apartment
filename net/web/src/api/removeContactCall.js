import { checkResponse, fetchWithTimeout } from './fetchUtil';

export async function removeContactCall(server, token, callId) {
  const host = "";
  if (server) {
    host = `https://${server}`
  }

  var call = await fetchWithTimeout(`${host}/talk/calls/${callId}?contact=${token}`, { method: 'DELETE' });
  checkResponse(call);
}

