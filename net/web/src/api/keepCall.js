import { checkResponse, fetchWithTimeout } from './fetchUtil';

export async function keepCall(token, callId) {
  const param = "?agent=" + token
  const call = await fetchWithTimeout(`/talk/calls/${callId}` + param, { method: 'PUT' });
  checkResponse(call)
}

