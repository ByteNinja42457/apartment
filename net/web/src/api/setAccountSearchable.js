import { checkResponse, fetchWithTimeout } from './fetchUtil';

export async function setAccountSearchable(token, flag) {
  const res = await fetchWithTimeout('/account/searchable?agent=' + token, { method: 'PUT', body: JSON.stringify(flag) })
  checkResponse(res);
}

