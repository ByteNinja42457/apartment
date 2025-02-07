import { checkResponse, fetchWithTimeout } from './fetchUtil';

export async function addNodeAccountAccess(server: string, secure: boolean, token: string, accountId: number): Promise<string> {
  let endpoint = `http${secure ? 's' : ''}://${server}/admin/accounts/${accountId}/auth?token=${token}`;
  let access = await fetchWithTimeout(endpoint, { method: 'POST' });
  checkResponse(access.status);
  return await access.json();
}
