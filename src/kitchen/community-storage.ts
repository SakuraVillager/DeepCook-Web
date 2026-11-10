import {
  emptyCommunity,
  validateCommunity,
  validScore,
  validatePostText,
  type CommunityDraft,
  type CommunityRecord,
  type KitchenPost,
} from './community'

export const COMMUNITY_DATABASE = 'deepcook-community'
const CHANNEL = 'deepcook-community-updates'
let database: Promise<IDBDatabase> | undefined
function open() {
  return (database ??= new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(COMMUNITY_DATABASE, 1)
    request.onupgradeneeded = () => {
      request.result.createObjectStore('recipes')
      request.result.createObjectStore('photos')
      request.result.createObjectStore('drafts')
    }
    request.onsuccess = () => {
      request.result.onversionchange = () => {
        request.result.close()
        database = undefined
      }
      resolve(request.result)
    }
    request.onerror = () => {
      database = undefined
      reject(new Error('本地互动存储无法打开，请检查浏览器存储设置。'))
    }
    request.onblocked = () => {
      database = undefined
      reject(new Error('互动存储正在更新，请关闭其他 DeepCook 标签页后重试。'))
    }
  }))
}
function announce(recipeId: string) {
  if (!('BroadcastChannel' in globalThis)) return
  try {
    const channel = new BroadcastChannel(CHANNEL)
    try {
      channel.postMessage(recipeId)
    } finally {
      channel.close()
    }
  } catch {
    // Notification failure must not hide a committed write.
  }
}
export const announceCommunityUpdate = announce
export async function saveCommunityPhoto(id: string, photo: Blob | null) {
  const db = await open()
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction('photos', 'readwrite')
    if (photo) tx.objectStore('photos').put(photo, id)
    else tx.objectStore('photos').delete(id)
    tx.oncomplete = () => resolve()
    tx.onabort = tx.onerror = () => reject(storageError(tx.error))
  })
}
export async function localCommunityPhotos(ids: string[]) {
  const db = await open()
  return new Promise<Set<string>>((resolve, reject) => {
    const tx = db.transaction('photos'),
      found = new Set<string>()
    for (const id of ids) {
      const req = tx.objectStore('photos').getKey(id)
      req.onsuccess = () => {
        if (req.result !== undefined) found.add(id)
      }
    }
    tx.oncomplete = () => resolve(found)
    tx.onabort = tx.onerror = () => reject(tx.error)
  })
}
export async function communityCache(recipeId: string, value?: unknown) {
  const db = await open()
  return new Promise<unknown>((resolve, reject) => {
    const tx = db.transaction(
      'recipes',
      value === undefined ? 'readonly' : 'readwrite',
    )
    const store = tx.objectStore('recipes')
    const request =
      value === undefined
        ? store.get(`cloud-cache/${recipeId}`)
        : store.put(value, `cloud-cache/${recipeId}`)
    tx.oncomplete = () => resolve(request.result)
    tx.onabort = tx.onerror = () => reject(tx.error)
  })
}
function storageError(problem?: unknown) {
  if (problem instanceof Error && !(problem instanceof DOMException))
    return problem
  return new Error(
    problem instanceof DOMException && problem.name === 'QuotaExceededError'
      ? '浏览器存储空间不足，文字和照片仍保留在当前编辑框中。请释放站点空间后重试。'
      : '互动记录保存失败，文字和照片仍已保留，请重试。',
  )
}
export async function readCommunity(
  recipeId: string,
): Promise<CommunityRecord> {
  const db = await open()
  return new Promise((resolve, reject) => {
    const tx = db.transaction('recipes'),
      req = tx.objectStore('recipes').get(recipeId)
    req.onsuccess = () => {
      try {
        resolve(validateCommunity(req.result, recipeId))
      } catch (e) {
        reject(e)
      }
    }
    req.onerror = () =>
      reject(new Error('本地互动记录暂时无法读取，原数据已保留。'))
  })
}
async function mutate(
  recipeId: string,
  action: (record: CommunityRecord, tx: IDBTransaction) => CommunityRecord,
) {
  const db = await open()
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction(['recipes', 'photos', 'drafts'], 'readwrite'),
      store = tx.objectStore('recipes'),
      req = store.get(recipeId)
    let problem: unknown
    req.onsuccess = () => {
      try {
        const next = action(validateCommunity(req.result, recipeId), tx)
        store.put(next, recipeId)
      } catch (e) {
        problem = e
        tx.abort()
      }
    }
    tx.oncomplete = () => {
      announce(recipeId)
      resolve()
    }
    tx.onerror = tx.onabort = () => reject(storageError(problem ?? tx.error))
  })
}
export function rateRecipe(recipeId: string, score: number, draftKey: string) {
  if (!validScore(score))
    return Promise.reject(new Error('评分必须为 1–10 分的整数。'))
  return mutate(recipeId, (record, tx) => {
    tx.objectStore('drafts').delete(draftKey)
    return { ...record, ownRating: score }
  })
}
export function addCommunityPost(
  recipeId: string,
  submission: boolean,
  text: string,
  photo: Blob | null,
  draftKey: string,
) {
  const body = validatePostText(text)
  if (
    photo &&
    (!submission || photo.type !== 'image/jpeg' || photo.size > 1048576)
  )
    return Promise.reject(new Error('请重新选择成品照片。'))
  const id = `post-${crypto.randomUUID()}`
  return mutate(recipeId, (record, tx) => {
    if (photo) tx.objectStore('photos').put(photo, id)
    tx.objectStore('drafts').delete(draftKey)
    const post: KitchenPost = {
      id,
      recipeId,
      submission,
      text: body,
      photo: photo ? id : null,
      author: '我',
      sample: false,
      createdAt: Date.now(),
    }
    return { ...record, posts: [post, ...record.posts] }
  })
}
export function deleteCommunityPost(recipeId: string, postId: string) {
  return mutate(recipeId, (record, tx) => {
    const post = record.posts.find((p) => p.id === postId)
    if (!post || post.sample) throw new Error('只能删除自己的评论或作业。')
    if (post.photo) tx.objectStore('photos').delete(post.photo)
    return { ...record, posts: record.posts.filter((p) => p.id !== postId) }
  })
}
export async function readCommunityPhoto(id: string): Promise<Blob> {
  const db = await open()
  return new Promise((resolve, reject) => {
    const req = db.transaction('photos').objectStore('photos').get(id)
    req.onsuccess = () =>
      req.result instanceof Blob && req.result.type === 'image/jpeg'
        ? resolve(req.result)
        : reject(new Error('照片暂时无法读取，原记录已保留。'))
    req.onerror = () => reject(new Error('照片暂时无法读取，原记录已保留。'))
  })
}
export function communityDraftKey(recipeId: string) {
  let session: string
  try {
    session =
      sessionStorage.getItem('deepcook-community-session') ??
      crypto.randomUUID()
    sessionStorage.setItem('deepcook-community-session', session)
  } catch {
    session = 'current-browser'
  }
  return `${session}/${recipeId}`
}
function validDraft(value: unknown): value is CommunityDraft {
  const d = value as CommunityDraft
  return Boolean(
    d &&
    ['rating', 'comment', 'submission'].includes(d.kind) &&
    typeof d.text === 'string' &&
    d.text.length <= 2000 &&
    validScore(d.score) &&
    (d.photo === null ||
      (d.photo instanceof Blob &&
        d.photo.type === 'image/jpeg' &&
        d.photo.size <= 1048576)),
  )
}
export async function readCommunityDraft(
  key: string,
): Promise<CommunityDraft | null> {
  const db = await open()
  return new Promise((resolve, reject) => {
    const req = db.transaction('drafts').objectStore('drafts').get(key)
    req.onsuccess = () => {
      if (req.result === undefined) resolve(null)
      else if (validDraft(req.result)) resolve(req.result)
      else reject(new Error('互动草稿无法读取，原草稿已保留。'))
    }
    req.onerror = () => reject(new Error('互动草稿暂时无法读取。'))
  })
}
export async function saveCommunityDraft(
  key: string,
  draft: CommunityDraft | null,
) {
  if (draft && !validDraft(draft))
    throw new Error('草稿格式不正确，当前输入已保留。')
  const db = await open()
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction('drafts', 'readwrite'),
      store = tx.objectStore('drafts')
    if (draft) store.put(draft, key)
    else store.delete(key)
    tx.oncomplete = () => resolve()
    tx.onerror = tx.onabort = () => reject(storageError(tx.error))
  })
}
export async function prepareCommunityPhoto(file: File): Promise<Blob> {
  if (
    !/^image\/(jpeg|png|webp)$/.test(file.type) ||
    file.size > 20 * 1024 * 1024
  )
    throw new Error('请选择 20 MB 以内的 JPG、PNG 或 WebP 照片。')
  let bitmap: ImageBitmap
  try {
    bitmap = await createImageBitmap(file, {
      resizeWidth: 1200,
      resizeQuality: 'high',
    })
  } catch {
    throw new Error('照片无法读取，请换一张。')
  }
  try {
    const canvas = document.createElement('canvas')
    canvas.width = 1200
    canvas.height = 900
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('当前浏览器无法处理照片。')
    const width = Math.min(bitmap.width, (bitmap.height * 4) / 3),
      height = (width * 3) / 4
    ctx.fillStyle = '#f3ede0'
    ctx.fillRect(0, 0, 1200, 900)
    ctx.drawImage(
      bitmap,
      (bitmap.width - width) / 2,
      (bitmap.height - height) / 2,
      width,
      height,
      0,
      0,
      1200,
      900,
    )
    for (const quality of [0.82, 0.65, 0.5]) {
      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, 'image/jpeg', quality),
      )
      if (blob && blob.size <= 1048576) return blob
    }
    throw new Error('照片压缩后仍过大，请裁剪后重试。')
  } finally {
    bitmap.close()
  }
}
export const communityUpdatesChannel = CHANNEL
export async function removeRecipeCommunity(recipeId: string) {
  await mutate(recipeId, (record, tx) => {
    for (const post of record.posts)
      if (post.photo) tx.objectStore('photos').delete(post.photo)
    const drafts = tx.objectStore('drafts').openCursor()
    drafts.onsuccess = () => {
      const cursor = drafts.result
      if (!cursor) return
      if (
        typeof cursor.key === 'string' &&
        cursor.key.slice(cursor.key.indexOf('/') + 1) === recipeId
      )
        cursor.delete()
      cursor.continue()
    }
    return emptyCommunity(recipeId)
  })
}
