import { checkResponse, fetchWithTimeout } from './fetchUtil';

export async function getListingMessage(server, guid) {
  var insecure = /^(?!0)(?!.*\.$)((1?\d?\d|25[0-5]|2[0-4]\d)(\.|:\d+$|$)){4}$/.test(server);
  var protocol = insecure ? 'http' : 'https';

  let listing = await fetchWithTimeout(`${protocol}://${server}/account/listing/${guid}/message`, { method: 'GET' });
  checkResponse(listing);
  return await listing.json();
}

