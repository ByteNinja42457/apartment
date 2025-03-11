import { checkResponse, fetchWithTimeout } from './fetchUtil';
import { ChannelEntity } from '../entities';

export async function getChannels(node: string, secure: boolean, token: string, revision: number, types: string[]): Promise<ChannelEntity[]> {
  let params = (revision ? `&channelRevision=${revision}` : '') + `&types=${encodeURIComponent(JSON.stringify(types))}`;
  let endpoint = `http${secure ? 's' : ''}://${node}/content/channels?agent=${token}${params}`;
  let channels = await fetchWithTimeout(endpoint, { method: 'GET' });
  checkResponse(channels.status);
  return await channels.json();
}
