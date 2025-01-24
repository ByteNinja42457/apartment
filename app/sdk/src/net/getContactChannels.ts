import { checkResponse, fetchWithTimeout } from './fetchUtil';
import { ChannelEntity } from '../entities';

export async function getContactChannels(node: string, secure: boolean, guid: string, token: string, revision: number, types: string[]): Promise<ChannelEntity[]> {
  let type = `types=${encodeURIComponent(JSON.stringify(types))}`;
  let param = revision ? `viewRevision=1&channelRevision=${revision}` : `viewRevision=1`;
  let endpoint = `http${secure ? 's' : ''}://${node}/content/channels?contact=${guid}.${token}&${param}&${type}`;
  let channels = await fetchWithTimeout(endpoint, { method: 'GET' });
  checkResponse(channels.status);
  return await channels.json();
}
