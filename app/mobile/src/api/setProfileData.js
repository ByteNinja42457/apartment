import { checkResponse, fetchWithTimeout } from './fetchUtil';

export async function setProfileData(server, token, name, location, description) {
  var insecure = /^(?!0)(?!.*\.$)((1?\d?\d|25[0-5]|2[0-4]\d)(\.|:\d+$|$)){4}$/.test(server);
  var protocol = insecure ? 'http' : 'https';

  const data = { name: name, location: location, description: description };
  const profile = await fetchWithTimeout(`${protocol}://${server}/profile/data?agent=${token}`, { method: 'PUT', body: JSON.stringify(data) });
  checkResponse(profile)
  return await profile.json()
}

