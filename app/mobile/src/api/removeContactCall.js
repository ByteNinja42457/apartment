import { checkResponse, fetchWithTimeout } from './fetchUtil';

export async function removeContactCall(server, token, callId) {
  let insecure = /^(?!0)(?!.*\.$)((1?\d?\d|25[0-5]|2[0-4]\d)(\.|:\d+$|$)){4}$/.test(server);
  let protocol = insecure ? 'http' : 'https';

  let call = await fetchWithTimeout(`${protocol}://${server}/talk/calls/${callId}?contact=${token}`, { method: 'DELETE' });
  checkResponse(call);
}
