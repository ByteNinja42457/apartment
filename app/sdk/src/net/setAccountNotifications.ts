import { checkResponse, fetchWithTimeout } from './fetchUtil';
import { PushParams } from '../types';

export async function setAccountNotifications(node: string, secure: boolean, token: string, flag: boolean, pushParams?: PushParams) {
  let pushEndpoint = pushParams ? encodeURIComponent(pushParams.endpoint) : '';
  let publicKey = pushParams ? encodeURIComponent(pushParams.publicKey) : '';
  let auth = pushParams ? encodeURIComponent(pushParams.auth) : '';
  let params = pushParams ? `&webEndpoint=${pushEndpoint}&webPublicKey=${publicKey}&webAuth=${auth}&pushType=${pushParams.type}` : ''
  let endpoint = `http${secure ? 's' : ''}://${node}/account/notification?agent=${token}${params}`;
  let { status } = await fetchWithTimeout(endpoint, {
    method: 'PUT',
    body: JSON.stringify(flag),
  });
  checkResponse(status);
}
