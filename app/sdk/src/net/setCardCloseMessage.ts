import { checkResponse, fetchWithTimeout } from './fetchUtil';
import { DataMessage } from '../entities';

export async function setCardCloseMessage(node: string, secure: boolean, message: DataMessage): Promise<void> {
  let endpoint = `http${secure ? 's' : ''}://${node}/contact/closeMessage`;
  let close = await fetchWithTimeout(endpoint, { method: 'PUT', body: JSON.stringify(message) });
  checkResponse(close.status);
}
