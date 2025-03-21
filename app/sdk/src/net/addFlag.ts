import { checkResponse, fetchWithTimeout } from './fetchUtil';

export async function addFlag(node: string, secure: boolean, guid: string, data: { channelId?: string; articleId?: string, topicId?: string }) {
  let endpoint = `http${secure ? 's' : ''}://${node}/account/flag/${guid}`;
  let response = await fetchWithTimeout(endpoint, { method: 'POST', body: JSON.stringify(data) });
  checkResponse(response.status);
}
