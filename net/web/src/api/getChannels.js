import { checkResponse, fetchWithTimeout } from './fetchUtil';

export async function getChannels(token, revision) {
  const param = "?agent=" + token
  if (revision != null) {
    param += `&channelRevision=${revision}`
  }
  const types = encodeURIComponent(JSON.stringify([ 'sealed', 'superbasic' ]));
  param += `&types=${types}`
  const channels = await fetchWithTimeout('/content/channels' + param, { method: 'GET' });
  checkResponse(channels)
  const ret = await channels.json()
  return ret;
}

