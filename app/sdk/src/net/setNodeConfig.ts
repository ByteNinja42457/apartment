import { checkResponse, fetchWithTimeout } from './fetchUtil';
import { SetupEntity } from '../entities';

export async function setNodeConfig(server: string, secure: boolean, token: string, config: SetupEntity) {
  let endpoint = `http${secure ? 's' : ''}://${server}/admin/config?token=${token}`;
  let { status }= await fetchWithTimeout(endpoint, { method: 'PUT', body: JSON.stringify(config) });
  checkResponse(status);
}

