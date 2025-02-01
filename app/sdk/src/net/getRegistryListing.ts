import { checkResponse, fetchWithTimeout } from './fetchUtil';
import { AccountEntity } from '../entities';

export async function getRegistryListing(handle: string | null, server: string, secure: boolean): Promise<AccountEntity[]> {
  let param = handle ? `?filter=${handle}` : '';
  let endpoint = `http${secure ? 's' : ''}://${server}/account/listing${param}`;
  let listing = await fetchWithTimeout(endpoint, { method: 'GET' });
  checkResponse(listing.status);
  return await listing.json();
}
