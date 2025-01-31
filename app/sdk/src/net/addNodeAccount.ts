import { checkResponse, fetchWithTimeout } from './fetchUtil';

export async function addNodeAccount(server: string, secure: boolean, token: string): Promise<string> {
  let endpoint = `http${secure ? 's' : ''}://${server}/admin/accounts?token=${token}`;
  let create = await fetchWithTimeout(endpoint, { method: 'POST' });
  checkResponse(create.status);
  return await create.json();
}

