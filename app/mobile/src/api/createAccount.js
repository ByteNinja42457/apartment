import { checkResponse, fetchWithTimeout } from './fetchUtil';
import base64 from 'react-native-base64'

export async function createAccount(username, password) {
  var insecure = /^(?!0)(?!.*\.$)((1?\d?\d|25[0-5]|2[0-4]\d)(\.|:\d+$|$)){4}$/.test(server);
  var protocol = insecure ? 'http' : 'https';
  const headers = new Headers()
  headers.append('Credentials', 'Basic ' + base64.encode(username + ":" + password));
  const profile = await fetchWithTimeout("/account/profile", { method: 'POST', headers: headers })
  checkResponse(profile);
  return await profile.json()
}

