import { checkResponse, fetchWithTimeout } from './fetchUtil';

export async function setChannelSubject(node: string, secure: boolean, token: string, channelId: string, type: string, data: any): Promise<void> {
  let params = { dataType: type, data: JSON.stringify(data) };
  let endpoint = `http${secure ? 's' : ''}://${node}/content/channels/${channelId}/subject?agent=${token}`;
  let { status } = await fetchWithTimeout(endpoint, {
    method: 'PUT',
    body: JSON.stringify(params),
  });
  checkResponse(status);
}
