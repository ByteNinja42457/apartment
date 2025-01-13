import { checkResponse, fetchWithTimeout } from './fetchUtil';

export async function setAdmin(node: string, secure: boolean, token: string, mfaCode: string | null): Promise<string> {
  let mfa = mfaCode ? `&code=${mfaCode}` : '';
  let endpoint = `http${secure ? 's' : ''}://${node}/admin/access?token=${encodeURIComponent(token)}${mfa}`;
  let admin = await fetchWithTimeout(endpoint, { method: 'PUT' });
  checkResponse(admin.status);
  return await admin.json();
}
