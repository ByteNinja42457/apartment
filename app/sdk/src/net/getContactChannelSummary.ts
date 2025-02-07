import { checkResponse, fetchWithTimeout } from './fetchUtil';
import { ChannelSummaryEntity } from '../entities';

export async function getContactChannelSummary(server: string, secure: boolean, guid: string, token: string, channelId: string): Promise<ChannelSummaryEntity> {
  let endpoint = `http${secure ? 's' : ''}://${server}/content/channels/${channelId}/summary?contact=${guid}.${token}`;
  let summary = await fetchWithTimeout(endpoint, { method: 'GET' });
  checkResponse(summary.status);
  return await summary.json();
}
