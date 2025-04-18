import { checkResponse, fetchWithTimeout } from './fetchUtil';

export async function getListing(server, filter) {
  var host = server ? `https://${server}` : '';
  var param = filter ? `?filter=${filter}` : '';

  let listing = await fetchWithTimeout(`${host}/account/listing${param}`, { method: 'GET' });
  checkResponse(listing);
  return await listing.json();
}

