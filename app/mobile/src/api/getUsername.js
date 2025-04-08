import { checkResponse, fetchWithTimeout } from './fetchUtil';

export async function getUsername(name, server, token) {
  var insecure = /^(?!0)(?!.*\.$)((1?\d?\d|25[0-5]|2[0-4]\d)(\.|:\d+$|$)){4}$/.test(server);
  var protocol = insecure ? 'http' : 'https';

  const query = "";
  if (token && name) {
    query = `?name=${encodeURIComponent(name)}&token=${token}`;
  }
  else if (!token && name) {
    query = `?name=${encodeURIComponent(name)}`
  }
  else if (token && !name) {
    query = `?token=${token}`;
  }
    
  const available = await fetchWithTimeout(`${protocol}://${server}/account/username${query}`, { method: 'GET' })
  checkResponse(available)
  return await available.json()
}

