import { checkResponse, fetchWithTimeout } from './fetchUtil';

export async function clearAccountSeal(node: string, secure: boolean, token: string) {
  let endpoint = `http${secure ? 's' : ''}://${node}/account/seal?agent=${token}`;
  let seal = await fetchWithTimeout(endpoint, { method: 'DELETE' });
  checkResponse(seal.status);
}
