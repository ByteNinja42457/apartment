import { checkResponse, fetchWithTimeout } from './fetchUtil';

export async function setChannelTopicSubject(node: string, secure: boolean, token: string, channelId: string, topicId: string, dataType: string, data: any) {
  let subject = { data: JSON.stringify(data), dataType };
  let endpoint = `http${secure ? 's' : '' }://${node}/content/channels/${channelId}/topics/${topicId}/subject?agent=${token}&confirm=true`;
  let { status } = await fetchWithTimeout(endpoint, { method: 'PUT', body: JSON.stringify(subject) });
  checkResponse(status);
}   

