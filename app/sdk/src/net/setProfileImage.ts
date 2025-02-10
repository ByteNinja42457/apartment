import { checkResponse, fetchWithTimeout } from './fetchUtil';

export async function setProfileImage(node: string, secure: boolean, token: string, image: string) {
  let endpoint = `http${secure ? 's' : ''}://${node}/profile/image?agent=${token}`;
  let { status } = await fetchWithTimeout(endpoint, {
    method: 'PUT',
    body: JSON.stringify(image),
  });
  checkResponse(status);
}
