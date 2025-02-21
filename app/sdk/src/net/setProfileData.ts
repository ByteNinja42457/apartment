import { checkResponse, fetchWithTimeout } from './fetchUtil';

export async function setProfileData(node: string, secure: boolean, token: string, name: string, location: string, description: string): Promise<void> {
  let data = { name: name, location: location, description: description };
  let endpoint = `http${secure ? 's' : ''}://${node}/profile/data?agent=${token}`;
  let { status } = await fetchWithTimeout(endpoint, { method: 'PUT', body: JSON.stringify(data) });
  checkResponse(status);
}
