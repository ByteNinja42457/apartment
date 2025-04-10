import { checkResponse, fetchWithTimeout } from './fetchUtil';

export async function removeAdminMFAuth(server: string, secure: boolean, token: string) {
  let endpoint = `http${secure ? 's' : ''}://${server}/admin/mfauth?token=${token}`;
  let { status } = await fetchWithTimeout(endpoint, { method: 'DELETE' });
  checkResponse(status);
}

