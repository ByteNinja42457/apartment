import { checkResponse, fetchWithTimeout } from './fetchUtil';

export async function clearLogin(node: string, secure: boolean, token: string, all: boolean): Promise<void> {
  let param = all ? '&all=true' : '';
  let endpoint = `http${secure ? 's' : ''}://${node}/account/apps?agent=${token}${param}`;
  let { status } = await fetchWithTimeout(endpoint, { method: 'DELETE' });
  checkResponse(status);
}
