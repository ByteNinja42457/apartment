import { checkResponse, fetchWithTimeout } from './fetchUtil';
import { ChannelSummaryEntity } from '../entities';

export async function getChannelSummary(node: string, secure: boolean, token: string, channelId: string): Promise<ChannelSummaryEntity> {
  let endpoint = `http${secure ? 's' : ''}://${node}/content/channels/${channelId}/summary?agent=${token}`;
  let summary = await fetchWithTimeout(endpoint, { method: 'GET' });
  checkResponse(summary.status);
  return await summary.json();
}
