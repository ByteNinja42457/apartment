import { checkResponse, fetchWithTimeout } from './fetchUtil';

export async function setAccountSearchable(node: string, secure: boolean, token: string, flag: boolean) {
  let endpoint = `http${secure ? 's' : ''}://${node}/account/searchable?agent=${token}`;
  let { status } = await fetchWithTimeout(endpoint, {
    method: 'PUT',
    body: JSON.stringify(flag),
  });
  checkResponse(status);
}
