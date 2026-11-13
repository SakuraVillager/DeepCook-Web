import {
  accountHint,
  apiRequest,
  RequestError,
  saveAccountHint,
  type Account,
} from './api'
import { readUser, updateUser, validateUser } from './storage'
import type { UserData } from './types'
import { copyGuestCommunityPhotos } from './community-storage'
import { hasFoodAnswers } from './food-recommendations'

export const userScope = (accountId?: string) =>
  accountId ? `account/${accountId}` : 'user'
function cloudPayload(value: UserData) {
  const { android: existing, foodSetup, ...wire } = value
  return {
    ...wire,
    android: {
      schema: 1 as const,
      preferences: existing?.preferences ?? {},
      foodSetup,
      dishNotes: existing?.dishNotes ?? [],
      coverOverrides: existing?.coverOverrides ?? {},
      privateCommunity: existing?.privateCommunity ?? {},
    },
  }
}
const writes = new Map<string, Promise<unknown>>()
function sessionChanged(account: Account) {
  if (accountHint()?.id === account.id) saveAccountHint(account)
}
export async function readCloudUser(accountId: string) {
  const result = await apiRequest('/account/data', 'GET', undefined, accountId)
  if (
    !Number.isSafeInteger(result.revision) ||
    result.revision < 0 ||
    result.account?.id !== accountId
  )
    throw new Error('账号同步数据异常，请重试。')
  const data = validateUser(result.data)
  sessionChanged(result.account)
  await updateUser(() => data, userScope(accountId), false).catch(() => {})
  return { data, revision: result.revision as number }
}
async function uploadImage(
  path: string | null | undefined,
  accountId: string,
  uploaded: Map<string, string>,
) {
  if (!path || !path.startsWith('data:image/')) return path
  const previous = uploaded.get(path)
  if (previous) return previous
  const input = await (await fetch(path)).blob()
  const bitmap = await createImageBitmap(input)
  let blob: Blob | null = null
  try {
    const canvas = document.createElement('canvas'),
      scale = Math.min(1, 1200 / Math.max(bitmap.width, bitmap.height))
    canvas.width = Math.max(1, Math.round(bitmap.width * scale))
    canvas.height = Math.max(1, Math.round(bitmap.height * scale))
    const context = canvas.getContext('2d')
    if (!context) throw new Error('当前浏览器无法处理图片。')
    context.fillStyle = '#f3ede0'
    context.fillRect(0, 0, canvas.width, canvas.height)
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
    for (const quality of [0.82, 0.65, 0.5]) {
      blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, 'image/jpeg', quality),
      )
      if (blob && blob.size <= 1048576) break
    }
  } finally {
    bitmap.close()
  }
  if (!blob || blob.size > 1048576)
    throw new Error('图片压缩失败，请重新选择。')
  const result = await apiRequest('/account/media', 'PUT', blob, accountId)
  if (
    !/^\/deepcook-api\/v1\/account\/media\/[a-f0-9]{64}\.jpg$/.test(
      result.photoUrl,
    )
  )
    throw new Error('图片上传返回异常，请重试。')
  uploaded.set(path, result.photoUrl)
  return result.photoUrl as string
}
async function withCloudImages(
  value: UserData,
  accountId: string,
  uploaded: Map<string, string>,
) {
  const data = structuredClone(value)
  data.profile.avatar =
    (await uploadImage(data.profile.avatar, accountId, uploaded)) ?? null
  for (const recipe of data.recipes) {
    recipe.cover = await uploadImage(recipe.cover, accountId, uploaded)
    for (const step of recipe.steps)
      step.image = await uploadImage(step.image, accountId, uploaded)
  }
  return data
}
export function saveCloudUser(
  accountId: string,
  transform: (value: UserData) => UserData,
): Promise<UserData> {
  const pending = (writes.get(accountId) ?? Promise.resolve())
    .catch(() => {})
    .then(async () => {
      const uploaded = new Map<string, string>()
      const mutationId = crypto.randomUUID()
      for (let attempt = 0; attempt < 4; attempt++) {
        const current = await readCloudUser(accountId)
        const data = await withCloudImages(
          validateUser(transform(structuredClone(current.data))),
          accountId,
          uploaded,
        )
        try {
          const body = { revision: current.revision, data: cloudPayload(data), mutationId }
          let result
          try {
            result = await apiRequest('/account/data', 'PUT', body, accountId)
          } catch (problem) {
            if (!(problem instanceof RequestError && problem.status === 0))
              throw problem
            // The first response may have been lost after the transaction committed.
            result = await apiRequest('/account/data', 'PUT', body, accountId)
          }
          const saved = validateUser(result.data)
          sessionChanged(result.account)
          await updateUser(() => saved, userScope(accountId)).catch(() => {})
          return saved
        } catch (error) {
          if (
            !(error instanceof RequestError && error.status === 409) ||
            attempt === 3
          )
            throw error
        }
      }
      throw new Error('其他设备仍在更新，请稍后重试。')
    })
  writes.set(accountId, pending)
  void pending
    .finally(() => {
      if (writes.get(accountId) === pending) writes.delete(accountId)
    })
    .catch(() => {})
  return pending
}
export function mergeUserData(remote: UserData, local: UserData) {
  const mergeSaved = (a: UserData['favorites'], b: UserData['favorites']) =>
    [
      ...new Map(
        [...b, ...a]
          .sort((x, y) => x.timestamp - y.timestamp)
          .map((row) => [row.recipeId, row]),
      ).values(),
    ].sort((x, y) => y.timestamp - x.timestamp)
  const fresh =
    !remote.recipes.length &&
    !remote.favorites.length &&
    !remote.recent.length &&
    !remote.profile.avatar &&
    !remote.profile.likes.length &&
    !remote.profile.avoids.length &&
    remote.preferences.theme === 'system' &&
    remote.preferences.readingSize === 'standard' &&
    remote.preferences.showStepImages &&
    !remote.preferences.keepScreenOn
  const avoids = [
    ...new Set([
      ...remote.profile.avoids,
      ...local.profile.avoids.filter(
        (tag) => !remote.profile.likes.includes(tag),
      ),
    ]),
  ]
  return {
    ...remote,
    favorites: mergeSaved(remote.favorites, local.favorites),
    recent: mergeSaved(remote.recent, local.recent).slice(0, 50),
    recipes: [
      ...new Map(
        [...local.recipes, ...remote.recipes].map((recipe) => [
          recipe.id,
          recipe,
        ]),
      ).values(),
    ],
    profile: {
      name: remote.profile.name || local.profile.name,
      avatar: remote.profile.avatar || local.profile.avatar,
      likes: [
        ...new Set([...remote.profile.likes, ...local.profile.likes]),
      ].filter((tag) => !avoids.includes(tag)),
      avoids,
    },
    preferences: fresh ? local.preferences : remote.preferences,
    foodSetup: remote.foodSetup.completed || hasFoodAnswers(remote.foodSetup.profile)
      ? remote.foodSetup : local.foodSetup,
  }
}
export async function importLocalUser(accountId: string) {
  await copyGuestCommunityPhotos(accountId)
  const local = await readUser()
  const data = await saveCloudUser(accountId, (remote) =>
    mergeUserData(remote, local),
  )
  // Keep the original guest copy available; a later merge deduplicates by ID.
  return data
}
