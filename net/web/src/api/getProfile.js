import { checkResponse, fetchWithTimeout } from './fetchUtil';

export async function getProfile(token) {
  const profile = await fetchWithTimeout(`/profile?agent=${token}`, { method: 'GET' });
  checkResponse(profile)
  return await profile.json()
}


