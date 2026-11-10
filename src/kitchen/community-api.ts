import {
  validateCommunity,
  validScore,
  validatePostText,
  type CommunityDraft,
  type CommunityRecord,
  type KitchenPost,
} from './community'
import {
  announceCommunityUpdate,
  communityCache,
  localCommunityPhotos,
  saveCommunityDraft,
  saveCommunityPhoto,
} from './community-storage'

const endpoint = (import.meta.env.VITE_COMMUNITY_API ?? '').replace(/\/$/, '')
export const isCloudCommunity = (id: string) =>
  Boolean(id && endpoint) && !id.startsWith('user-')
export interface CloudCommunity extends CommunityRecord {
  ratingCounts: number[]
  postCounts: { comment: number; submission: number }
  cursors: { comment: string | null; submission: string | null }
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
class RequestError extends Error {
  readonly status: number
  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}
async function request(path: string, method = 'GET', body?: unknown) {
  const token = visitorToken()
  const controller = new AbortController()
  const timeout = window.setTimeout(() => controller.abort(), 10000)
  let response: Response
  try {
    response = await fetch(`${endpoint}${path}`, {
      method,
      credentials: 'omit',
      cache: 'no-cache',
      headers: {
        Authorization: `Bearer ${token}`,
        ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal,
    })
  } catch {
    throw new RequestError(
      '交流服务暂时无法连接，缓存、文字和照片已保留，请重试。',
      0,
    )
  } finally {
    window.clearTimeout(timeout)
  }
  let data
  try {
    data = await response.json()
  } catch {
    throw new Error('交流服务返回异常，请稍后重试。')
  }
  if (!response.ok)
    throw new RequestError(
      typeof data.error === 'string'
        ? data.error
        : '交流服务暂时不可用，请重试。',
      response.status,
    )
  return data
}
const route = (recipeId: string) => `/recipes/${encodeURIComponent(recipeId)}`
function validatePosts(value: unknown, recipeId: string): KitchenPost[] {
  const posts = validateCommunity(
    { schema: 1, recipeId, ownRating: null, posts: value },
    recipeId,
  ).posts
  if (
    posts.some(
      (p) =>
        typeof p.mine !== 'boolean' || p.cloud !== true || p.photo !== null,
    )
  )
    throw new Error('交流记录格式异常，请重试。')
  return posts
}
function validateCloud(value: unknown, recipeId: string): CloudCommunity {
  const r = value as CloudCommunity
  validateCommunity(value, recipeId)
  validatePosts(r.posts, recipeId)
  if (
    !Array.isArray(r.ratingCounts) ||
    r.ratingCounts.length !== 10 ||
    r.ratingCounts.some((n) => !Number.isSafeInteger(n) || n < 0) ||
    !r.postCounts ||
    !r.cursors ||
    ['comment', 'submission'].some((k) => {
      const key = k as 'comment' | 'submission'
      return (
        !Number.isSafeInteger(r.postCounts[key]) ||
        r.postCounts[key] < 0 ||
        !(r.cursors[key] === null || typeof r.cursors[key] === 'string')
      )
    })
  )
    throw new Error('交流统计格式异常，请重试。')
  return r
}
export async function cachedCloudCommunity(recipeId: string) {
  try {
    const cached = (await communityCache(recipeId)) as
      { identity: string; data: unknown } | undefined
    if (cached?.identity === visitorToken().slice(0, 16))
      return validateCloud(cached.data, recipeId)
  } catch {
    /* Keep old or damaged cache; the server remains authoritative. */
  }
  return null
}
export async function readCloudCommunity(recipeId: string) {
  const data = validateCloud(await request(route(recipeId)), recipeId)
  try {
    await communityCache(recipeId, {
      identity: visitorToken().slice(0, 16),
      data,
    })
  } catch {
    /* Reading still works when the optional cache is full. */
  }
  return data
}
export async function cloudPostsWithPhotos(posts: KitchenPost[]) {
  const photos = await localCommunityPhotos(
    posts.filter((p) => p.mine && p.submission).map((p) => p.id),
  )
  return posts.map((p) => ({ ...p, photo: photos.has(p.id) ? p.id : null }))
}
export async function moreCloudPosts(
  recipeId: string,
  submission: boolean,
  cursor: string,
) {
  const page = await request(
    `${route(recipeId)}/posts?kind=${submission ? 'submission' : 'comment'}&cursor=${encodeURIComponent(cursor)}`,
  )
  const posts = validatePosts(page.posts, recipeId)
  if (!(page.next === null || typeof page.next === 'string'))
    throw new Error('分页数据异常，请重试。')
  return { posts, next: page.next as string | null }
}
export async function publishRating(
  recipeId: string,
  score: number,
  draftKey: string,
) {
  if (!validScore(score)) throw new Error('评分必须为 1–10 分的整数。')
  await request(`${route(recipeId)}/rating`, 'PUT', { score })
  await saveCommunityDraft(draftKey, null)
  announceCommunityUpdate(recipeId)
}
export async function publishPost(
  recipeId: string,
  draft: CommunityDraft,
  draftKey: string,
) {
  const text = validatePostText(draft.text)
  if (!draft.postId) throw new Error('草稿标识缺失，请重新打开编辑框。')
  // Persist the id before sending: a lost response can be retried without duplicate posts.
  await saveCommunityDraft(draftKey, draft)
  if (draft.photo) await saveCommunityPhoto(draft.postId, draft.photo)
  await request(`${route(recipeId)}/posts`, 'POST', {
    id: draft.postId,
    submission: draft.kind === 'submission',
    text,
  })
  await saveCommunityDraft(draftKey, null)
  announceCommunityUpdate(recipeId)
}
export async function deleteCloudPost(recipeId: string, postId: string) {
  await request(
    `${route(recipeId)}/posts/${encodeURIComponent(postId)}`,
    'DELETE',
  )
  await saveCommunityPhoto(postId, null)
  announceCommunityUpdate(recipeId)
}
