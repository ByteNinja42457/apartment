import { checkResponse, fetchWithTimeout } from './fetchUtil';
import { SetupEntity } from '../entities';

export async function getNodeConfig(server: string, secure: boolean, token: string): Promise<SetupEntity> {
  let endpoint = `http${secure ? 's' : ''}://${server}/admin/config?token=${token}`;
  let config = await fetchWithTimeout(endpoint, { method: 'GET' });
  checkResponse(config.status);
  return await config.json();
}

