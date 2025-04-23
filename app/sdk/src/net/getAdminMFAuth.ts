import { checkResponse, fetchWithTimeout } from './fetchUtil';

export async function getAdminMFAuth(server: string, secure: boolean, token: string): Promise<boolean> {
  let endpoint = `http${secure ? 's' : ''}://${server}/admin/mfauth?token=${token}`;
  let mfa = await fetchWithTimeout(endpoint, { method: 'GET' });
  checkResponse(mfa.status);
  return await mfa.json();
}

