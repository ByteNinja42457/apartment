import { checkResponse, fetchWithTimeout } from './fetchUtil';

export async function addCall(token, cardId) {
  const param = "?agent=" + token
  const call = await fetchWithTimeout('/talk/calls' + param, { method: 'POST', body: JSON.stringify(cardId) });
  checkResponse(call)
  const ret = await call.json()
  return ret;
}

