import { checkResponse, fetchWithTimeout } from './fetchUtil';

export async function setNodeConfig(token, config) {
  const body = JSON.stringify(config);
  const settings = await fetchWithTimeout(`/admin/config?setOpenAccess=true&token=${encodeURIComponent(token)}`, { method: 'PUT', body });
  checkResponse(settings);
}

