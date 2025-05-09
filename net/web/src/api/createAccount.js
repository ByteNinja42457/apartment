import { checkResponse, fetchWithTimeout } from './fetchUtil';
var base64 = require('base-64');

export async function createAccount(username, password) {
  const headers = new Headers()
  headers.append('Credentials', 'Basic ' + base64.encode(username + ":" + password));
  const profile = await fetchWithTimeout("/account/profile", { method: 'POST', headers: headers })
  checkResponse(profile);
  return await profile.json()
}

