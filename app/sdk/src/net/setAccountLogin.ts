import { checkResponse, fetchWithTimeout } from './fetchUtil';
import { encode } from './base64';

export async function setAccountLogin(node: string, secure: boolean, token: string, username: string, password: string) {
  let endpoint = `http${secure ? 's' : ''}://${node}/account/login?agent=${token}`;
  let auth = encode(`${username}:${password}`);
  let headers = new Headers();
  headers.append('Credentials', `Basic ${auth}`);
  let { status } = await fetchWithTimeout(endpoint, {
    method: 'PUT',
    headers,
  });
  checkResponse(status);
}
