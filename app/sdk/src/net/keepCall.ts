import { checkResponse, fetchWithTimeout } from './fetchUtil';

export async function keepCall(node: string, secure: boolean, token: string, callId: string): Promise<void> {
  let endpoint = `http${secure ? 's' : ''}://${node}/talk/calls/${callId}?agent=${token}`;
  let { status } = await fetchWithTimeout(endpoint, { method: 'PUT' });
  checkResponse(status);
}

