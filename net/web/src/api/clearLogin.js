import { checkResponse, fetchWithTimeout } from './fetchUtil';

export async function clearLogin(token, all) {
console.log("LOGOUT: ", token, all);

  let param = all ? '&all=true' : ''
  let logout = await fetchWithTimeout(`/account/apps?agent=${token}${param}`, { method: 'DELETE' })
  checkResponse(logout)
}


