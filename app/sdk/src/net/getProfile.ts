import { checkResponse, fetchWithTimeout } from './fetchUtil';
import { ProfileEntity } from '../entities';

export async function getProfile(node: string, secure: boolean, token: string): Promise<ProfileEntity> {
  let endpoint = `http${secure ? 's' : ''}://${node}/profile?agent=${token}`;
  let profile = await fetchWithTimeout(endpoint, { method: 'GET' });
  checkResponse(profile.status);
  return await profile.json();
}
