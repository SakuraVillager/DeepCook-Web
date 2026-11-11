export const endpoint = (import.meta.env?.VITE_COMMUNITY_API ?? '').replace(
  /\/$/,
  '',
)
export interface Account {
  id: string
  username: string
  name: string
}
export const ACCOUNT_EVENT = 'deepcook-account-change'
const ACCOUNT_KEY = 'deepcook-account-v1'
export function accountHint(): Account | null {
  if (!endpoint) return null
  try {
    const value = JSON.parse(localStorage.getItem(ACCOUNT_KEY) ?? 'null')
    return value &&
      typeof value.id === 'string' &&
      typeof value.username === 'string' &&
      typeof value.name === 'string'
      ? value
      : null
  } catch {
    return null
  }
}
export function saveAccountHint(account: Account | null) {
  try {
    if (account) localStorage.setItem(ACCOUNT_KEY, JSON.stringify(account))
    else localStorage.removeItem(ACCOUNT_KEY)
  } catch {
    /* The HttpOnly session still works without the optional hint. */
  }
  window.dispatchEvent(new Event(ACCOUNT_EVENT))
}
export function visitorToken() {
  const key = 'deepcook-community-visitor-v1'
  try {
    let token = localStorage.getItem(key)
    if (!token || !/^[a-f0-9]{64}$/.test(token)) {
      token = Array.from(crypto.getRandomValues(new Uint8Array(32)), (n) =>
        n.toString(16).padStart(2, '0'),
      ).join('')
      localStorage.setItem(key, token)
    }
    return token
  } catch {
    throw new Error('无法保存此浏览器的访客身份，请检查浏览器存储设置后重试。')
  }
}
export class RequestError extends Error {
  readonly status: number
  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}
export async function apiRequest(
  path: string,
  method = 'GET',
  body?: unknown,
  requireAccount: boolean | string = true,
) {
  const token = visitorToken(),
    account =
      typeof requireAccount === 'string'
        ? { id: requireAccount }
        : requireAccount
          ? accountHint()
          : null
  const controller = new AbortController()
  const timeout = window.setTimeout(
    () => controller.abort(),
    body instanceof Blob ? 60000 : 15000,
  )
  let response: Response
  try {
    response = await fetch(`${endpoint}${path}`, {
      method,
      credentials: 'include',
      cache: 'no-store',
      headers: {
        Authorization: `Bearer ${token}`,
        ...(account ? { 'X-DeepCook-Account': account.id } : {}),
        ...(body === undefined
          ? {}
          : {
              'Content-Type':
                body instanceof Blob ? body.type : 'application/json',
            }),
      },
      body:
        body === undefined
          ? undefined
          : body instanceof Blob
            ? body
            : JSON.stringify(body),
      signal: controller.signal,
    })
  } catch {
    throw new RequestError(
      '云端服务暂时无法连接，缓存、文字和照片已保留，请重试。',
      0,
    )
  } finally {
    window.clearTimeout(timeout)
  }
  let data
  try {
    data = await response.json()
  } catch {
    throw new Error('云端服务返回异常，请稍后重试。')
  }
  if (!response.ok) {
    if (response.status === 401 && account && accountHint()?.id === account.id)
      window.dispatchEvent(new Event('deepcook-session-expired'))
    throw new RequestError(
      typeof data.error === 'string'
        ? data.error
        : '云端服务暂时不可用，请重试。',
      response.status,
    )
  }
  return data
}
export function privateImageUrl(path: string) {
  if (
    !/^\/deepcook-api\/v1\/account\/media\/[a-f0-9]{64}\.jpg$/.test(path) ||
    !endpoint
  )
    return undefined
  return new URL(path, new URL(endpoint, document.baseURI).origin).href
}
