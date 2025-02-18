import { checkResponse, fetchWithTimeout } from './fetchUtil';

export async function getListingMessage(server, guid) {
  const host = "";
  if (server) {
    host = `https://${server}`;
  }

  const listing = await fetchWithTimeout(`${host}/account/listing/${guid}/message`, { method: 'GET' });
  checkResponse(listing);
  return await listing.json();
}

