import { checkResponse, fetchWithTimeout } from './fetchUtil';
import { DataMessage } from '../entities';

export async function getContactProfile(node: string, secure: boolean, guid: string, token: string): Promise<DataMessage> {
  let endpoint = `http${secure ? 's' : ''}://${node}/profile/message?contact=${guid}.${token}`;
  let profile = await fetchWithTimeout(endpoint, { method: 'GET' });
  checkResponse(profile.status);
  return await profile.json();
}
