import { checkResponse, fetchWithTimeout } from './fetchUtil';

export async function setNodeConfig(server, token, config) {
  var insecure = /^(?!0)(?!.*\.$)((1?\d?\d|25[0-5]|2[0-4]\d)(\.|:\d+$|$)){4}$/.test(server);
  var protocol = insecure ? 'http' : 'https';

  const body = JSON.stringify(config);
  const settings = await fetchWithTimeout(`${protocol}://${server}/admin/config?token=${token}`, { method: 'PUT', body });
  checkResponse(settings);
}

