import { checkResponse, fetchWithTimeout } from './fetchUtil';

export async function getContactChannels(server, token, viewRevision, channelRevision) {
  const host = "";
  if (server) {
    host = `https://${server}`;
  }

  const param = "?contact=" + token
  if (viewRevision != null) {
    param += '&viewRevision=' + viewRevision
  }
  if (channelRevision != null) {
    param += '&channelRevision=' + channelRevision
  }
  const types = encodeURIComponent(JSON.stringify([ 'sealed', 'superbasic' ]));
  param += `&types=${types}`
  const channels = await fetchWithTimeout(`${host}/content/channels${param}`, { method: 'GET' });
  checkResponse(channels)
  return await channels.json()
}

