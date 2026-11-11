import {
  validateCommunity,
  validScore,
  validatePostText,
  isCloudPhoto,
  type CommunityDraft,
  type CommunityRecord,
  type KitchenPost,
} from './community'
import {
  announceCommunityUpdate,
  communityCache,
  localCommunityPhotos,
  readCommunityPhoto,
  saveCommunityDraft,
  saveCommunityPhoto,
} from './community-storage'

import {
  endpoint,
  visitorToken,
  accountHint,
  apiRequest as request,
} from './api'
export { visitorToken } from './api'
export const isCloudCommunity = (id: string) =>
  Boolean(id && endpoint) && !id.startsWith('user-')
export interface CloudCommunity extends CommunityRecord {
  ratingCounts: number[]
  postCounts: { comment: number; submission: number }
  cursors: { comment: string | null; submission: string | null }
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
        typeof p.mine !== 'boolean' ||
        p.cloud !== true ||
        !(p.photoUrl == null || (p.submission && isCloudPhoto(p.photoUrl))) ||
        !(p.photo === null || p.photo === p.photoUrl),
    )
  )
    throw new Error('交流记录格式异常，请重试。')
  return posts.map((p) => ({ ...p, photo: p.photoUrl ?? null }))
}
function validateCloud(value: unknown, recipeId: string): CloudCommunity {
  const r = value as CloudCommunity
  validateCommunity(value, recipeId)
  const posts = validatePosts(r.posts, recipeId)
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
  return { ...r, posts }
}
export async function cachedCloudCommunity(recipeId: string) {
  try {
    const cached = (await communityCache(recipeId)) as
      { identity: string; data: unknown } | undefined
    if (cached?.identity === (accountHint()?.id ?? visitorToken().slice(0, 16)))
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
      identity: accountHint()?.id ?? visitorToken().slice(0, 16),
      data,
    })
  } catch {
    /* Reading still works when the optional cache is full. */
  }
  return data
}
export function cloudPhotoUrl(path: string) {
  if (!isCloudPhoto(path)) throw new Error('图片地址无效。')
  return new URL(path, new URL(endpoint, location.href).origin).href
}
export async function cloudPostsWithPhotos(
  posts: KitchenPost[],
  migrate = false,
) {
  const photos = await localCommunityPhotos(
    posts.filter((p) => p.mine && p.submission).map((p) => p.id),
  )
  const result: KitchenPost[] = []
  let migratedAny = false
  for (const post of posts) {
    if (post.photo || !photos.has(post.id)) {
      if (post.photo && photos.has(post.id))
        await saveCommunityPhoto(post.id, null).catch(() => {})
      result.push(post)
      continue
    }
    if (migrate) {
      try {
        const photo = await readCommunityPhoto(post.id)
        const uploaded = await request(
          `${route(post.recipeId)}/posts/${post.id}/photo`,
          'PUT',
          photo,
        )
        if (isCloudPhoto(uploaded.photoUrl)) {
          await saveCommunityPhoto(post.id, null).catch(() => {})
          result.push({
            ...post,
            photo: uploaded.photoUrl,
            photoUrl: uploaded.photoUrl,
          })
          migratedAny = true
          continue
        }
      } catch {
        /* Preserve the legacy local copy and retry on the next online read. */
      }
    }
    result.push({ ...post, photo: post.id, photoPending: true })
  }
  if (migratedAny && posts[0])
    await readCloudCommunity(posts[0].recipeId).catch(() => {})
  return result
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
  if (draft.photo)
    await request(
      `${route(recipeId)}/uploads/${draft.postId}`,
      'PUT',
      draft.photo,
    )
  await request(`${route(recipeId)}/posts`, 'POST', {
    id: draft.postId,
    submission: draft.kind === 'submission',
    text,
    photo: Boolean(draft.photo),
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
export async function discardCloudUpload(recipeId: string, postId: string) {
  await request(
    `${route(recipeId)}/uploads/${encodeURIComponent(postId)}`,
    'DELETE',
  )
}
