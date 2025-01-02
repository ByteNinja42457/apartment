import { checkResponse, fetchWithTimeout } from './fetchUtil';
import { encode } from './base64';

export async function setLogin(
  node: string,
  secure: boolean,
  username: string,
  password: string,
  code: string | null,
  appName: string,
  appVersion: string,
  platform: string,
  deviceToken: string,
  pushType: string,
  notifications: { event: string; messageTitle: string }[],
): Promise<{
  guid: string;
  appToken: string;
  created: number;
  pushSupported: boolean;
}> {
  let mfa = code ? `&code=${code}` : '';
  let endpoint = `http${secure ? 's' : ''}://${node}/account/apps?appName=${appName}&appVersion=${appVersion}&platform=${platform}&deviceToken=${deviceToken}&pushType=${pushType}${mfa}`;
  let auth = encode(`${username}:${password}`);
  let headers = new Headers();
  headers.append('Authorization', 'Basic ' + auth);
  let login = await fetchWithTimeout(endpoint, {
    method: 'POST',
    headers,
    body: JSON.stringify(notifications),
  });
  checkResponse(login.status);
  return await login.json();
}
