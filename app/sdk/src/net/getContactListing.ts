import { checkResponse, fetchWithTimeout } from './fetchUtil';
import { DataMessage } from '../entities';

export async function getContactListing(node: string, secure: boolean, guid: string): Promise<DataMessage> {
  let endpoint = `http${secure ? 's' : ''}://${node}/account/listing/${guid}/message`;
  let listing = await fetchWithTimeout(endpoint, { method: 'GET' });
  checkResponse(listing.status);
  return await listing.json();
}
