import { checkResponse, fetchWithCustomTimeout } from './fetchUtil';
var base64 = require('base-64');

export async function addAccount(username, password, token) {
  const access = "";
  if (token) {
    access = `?token=${token}`
  }
  const headers = new Headers()
  headers.append('Credentials', 'Basic ' + base64.encode(username + ":" + password));
  const profile = await fetchWithCustomTimeout(`/account/profile${access}`, { method: 'POST', headers: headers }, 60000)
  checkResponse(profile);
  return await profile.json()
}

