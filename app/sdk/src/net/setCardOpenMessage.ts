import { checkResponse, fetchWithTimeout } from './fetchUtil';
import { DataMessage, ContactStatus } from '../entities';

export async function setCardOpenMessage(node: string, secure: boolean, message: DataMessage): Promise<ContactStatus> {
  let endpoint = `http${secure ? 's' : ''}://${node}/contact/openMessage`;
  let open = await fetchWithTimeout(endpoint, { method: 'PUT', body: JSON.stringify(message) });
  checkResponse(open.status);
  return await open.json();
}
