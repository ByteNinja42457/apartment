import { checkResponse, fetchWithTimeout } from './fetchUtil';

export async function removeCall(token, callId) {
  const param = "?agent=" + token
  const call = await fetchWithTimeout(`/talk/calls/${callId}` + param, { method: 'DELETE' });
  checkResponse(call)
}

