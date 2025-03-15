import { checkResponse, fetchWithTimeout } from './fetchUtil';

export async function getUsername(name, token) {
  const access = "";
  if (token) {
    access = `&token=${token}`
  }
  const available = await fetchWithTimeout('/account/username?name=' + encodeURIComponent(name) + access, { method: 'GET' })
  checkResponse(available)
  return await available.json()
}

