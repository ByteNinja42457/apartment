import { checkResponse, fetchWithTimeout } from './fetchUtil';

export async function getAvailable() {
  const available = await fetchWithTimeout("/account/available", { method: 'GET' })
  checkResponse(available)
  return await available.json()
}

