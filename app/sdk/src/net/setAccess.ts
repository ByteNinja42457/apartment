import { checkResponse, fetchWithTimeout } from './fetchUtil';

export async function setAccess(
  node: string,
  secure: boolean,
  token: string,
  appName: string,
  appVersion: string,
  platform: string,
  deviceToken: string,
  pushType: string,
  notifications: { event: string; messageTitle: string }[],
): Promise<{
  guid: string;
  appToken: string;
  created: number;
  pushSupported: boolean;
}> {
  let endpoint = `http${secure ? 's' : ''}://${node}/account/access?token=${token}&appName=${appName}&appVersion=${appVersion}&platform=${platform}&deviceToken=${deviceToken}&pushType=${pushType}`;
  let access = await fetchWithTimeout(endpoint, {
    method: 'PUT',
    body: JSON.stringify(notifications),
  });
  checkResponse(access.status);
  return await access.json();
}
