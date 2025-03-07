import { checkResponse, fetchWithTimeout } from './fetchUtil';

export async function getNodeConfig(token) {
  const config = await fetchWithTimeout(`/admin/config?token=${encodeURIComponent(token)}`, { method: 'GET' });
  checkResponse(config);
  return await config.json();
}

