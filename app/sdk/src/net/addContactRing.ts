import { checkResponse, fetchWithTimeout } from './fetchUtil';
import { Ringing } from '../entities';

export async function addContactRing(server: string, secure: boolean, guid: string, token: string, ringing: Ringing) {
  let endpoint = `http${secure ? 's' : '' }://${server}/talk/rings?contact=${guid}.${token}`;
  let { status } = await fetchWithTimeout(endpoint, { method: 'POST', body: JSON.stringify(ringing) });
  checkResponse(status);
}

