import { checkResponse, fetchWithTimeout } from './fetchUtil';

export async function addFlag(server, guid, channel, topic) {
  let insecure = /^(?!0)(?!.*\.$)((1?\d?\d|25[0-5]|2[0-4]\d)(\.|:\d+$|$)){4}$/.test(server);
  let protocol = insecure ? 'http' : 'https';
  if (channel) {
    let param = topic ? `&topic=${topic}` : '';
    let flag = await fetchWithTimeout(`${protocol}://${server}/account/flag/${guid}?channel=${channel}${param}`, { method: 'POST' } );
    checkResponse(flag);
  }
  else {
    let flag = await fetchWithTimeout(`${protocol}://${server}/account/flag/${guid}`, { method: 'POST' } );
    checkResponse(flag);
  }
}

