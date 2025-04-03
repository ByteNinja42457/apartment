import { checkResponse, fetchWithTimeout } from './fetchUtil';
import { encode } from './base64';

export async function addAccount(node: string, secure: boolean, username: string, password: string, token: string | null): Promise<void> {
  let access = token ? `?token=${token}` : '';
  let endpoint = `http${secure ? 's' : ''}://${node}/account/profile${access}`;
  let auth = encode(`${username}:${password}`);
  let headers = new Headers();
  headers.append('Credentials', `Basic ${auth}`);
  let { status } = await fetchWithTimeout(endpoint, { method: 'POST', headers }, 60000);
  checkResponse(status);
}
