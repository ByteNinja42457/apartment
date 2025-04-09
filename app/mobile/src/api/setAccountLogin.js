import { checkResponse, fetchWithTimeout } from './fetchUtil';
import base64 from 'react-native-base64'

export async function setAccountLogin(server, token, username, password) {
  var insecure = /^(?!0)(?!.*\.$)((1?\d?\d|25[0-5]|2[0-4]\d)(\.|:\d+$|$)){4}$/.test(server);
  var protocol = insecure ? 'http' : 'https';

  const headers = new Headers()
  headers.append('Credentials', 'Basic ' + base64.encode(username + ":" + password));
  const res = await fetchWithTimeout(`${protocol}://${server}/account/login?agent=${token}`, { method: 'PUT', headers })
  checkResponse(res);
}

