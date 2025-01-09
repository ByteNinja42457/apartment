import { checkResponse, fetchWithTimeout } from './fetchUtil';
var base64 = require('base-64');

export async function setAccountLogin(token, username, password) {
  const headers = new Headers()
  headers.append('Credentials', 'Basic ' + base64.encode(username + ":" + password));
  const res = await fetchWithTimeout(`/account/login?agent=${token}`, { method: 'PUT', headers })
  checkResponse(res);
}

