import { checkResponse, fetchWithTimeout } from './fetchUtil';
import { AccountEntity } from '../entities';

export async function getMembers(server: string, secure: boolean, token: string): Promise<AccountEntity[]> {
  let endpoint = `http${secure ? 's' : ''}://${server}/admin/accounts?token=${token}`;
  let accounts = await fetchWithTimeout(endpoint, { method: 'GET' });
  checkResponse(accounts.status);
  return await accounts.json();
}
