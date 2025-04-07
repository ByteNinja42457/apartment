import { checkResponse, fetchWithTimeout } from './fetchUtil';

export async function getUsername(name: string, token: string | null, agent: string | null, node: string, secure: boolean): Promise<boolean> {
  let param = token ? `&token=${token}` : agent ? `&agent=${agent}` : '';
  let username = encodeURIComponent(name);
  let endpoint = `http${secure ? 's' : ''}://${node}/account/username?name=${username}${param}`;
  let taken = await fetchWithTimeout(endpoint, { method: 'GET' });
  checkResponse(taken.status);
  return await taken.json();
}
