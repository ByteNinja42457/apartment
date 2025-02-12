import { checkResponse, fetchWithTimeout } from './fetchUtil';

export async function addAccountAccess(token, accountId) {
  const access = await fetchWithTimeout(`/admin/accounts/${accountId}/auth?token=${encodeURIComponent(token)}`, { method: 'POST' })
  checkResponse(access);
  return await access.json()
}

