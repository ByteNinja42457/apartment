import { checkResponse, fetchWithTimeout } from './fetchUtil';

export async function setAdminMFAuth(server: string, secure: boolean, token: string, code: string): Promise<void> {
  let endpoint = `http${secure ? 's' : ''}://${server}/admin/mfauth?token=${token}&code=${code}`;
  let { status } = await fetchWithTimeout(endpoint, { method: 'PUT' });
  checkResponse(status);
}

