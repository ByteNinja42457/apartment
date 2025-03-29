import { checkResponse, fetchWithTimeout } from './fetchUtil';

export async function removeAccountMFAuth(node: string, secure: boolean, token: string) {
  let endpoint = `http${secure ? 's' : ''}://${node}/account/mfauth?agent=${token}`;
  let { status } = await fetchWithTimeout(endpoint, { method: 'DELETE' });
  checkResponse(status);
}
