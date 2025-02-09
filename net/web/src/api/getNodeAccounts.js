import { checkResponse, fetchWithTimeout } from './fetchUtil';

export async function getNodeAccounts(token) {
  const accounts = await fetchWithTimeout(`/admin/accounts?token=${encodeURIComponent(token)}`, { method: 'GET' });
  checkResponse(accounts);
  return await accounts.json();
}

