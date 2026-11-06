import { emptyUser, validRecipe } from './domain'
import type { UserData } from './types'

let database: Promise<IDBDatabase> | undefined
function open() {
  return (database ??= new Promise<IDBDatabase>((resolve, reject) => {
    const req = indexedDB.open('deepcook-kitchen', 1)
    req.onupgradeneeded = () => req.result.createObjectStore('data')
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => {
      database = undefined
      reject(new Error('浏览器存储无法打开，请检查隐私或存储设置。'))
    }
    req.onblocked = () => {
      database = undefined
      reject(new Error('请关闭其他 DeepCook 标签页后重试。'))
    }
  }))
}
function validate(value: unknown): UserData {
  if (value == null) return emptyUser()
  const d = value as UserData
  if (
    !d ||
    !Array.isArray(d.recipes) ||
    !d.recipes.every(validRecipe) ||
    ![d.favorites, d.recent].every(
      (a) =>
        Array.isArray(a) &&
        a.every(
          (x) =>
            typeof x.recipeId === 'string' && typeof x.timestamp === 'number',
        ),
    ) ||
    !d.profile ||
    typeof d.profile.name !== 'string' ||
    ![d.profile.likes, d.profile.avoids].every(
      (a) => Array.isArray(a) && a.every((x) => typeof x === 'string'),
    ) ||
    !(d.profile.avatar == null || typeof d.profile.avatar === 'string') ||
    !d.preferences ||
    !['system', 'light', 'dark'].includes(d.preferences.theme) ||
    !['standard', 'large', 'extra'].includes(d.preferences.readingSize) ||
    typeof d.preferences.showStepImages !== 'boolean' ||
    typeof d.preferences.keepScreenOn !== 'boolean'
  )
    throw new Error('本地数据暂时无法读取，原数据已保留。')
  return d
}
export async function readUser(): Promise<UserData> {
  const db = await open()
  return new Promise((resolve, reject) => {
    const tx = db.transaction('data', 'readonly'),
      req = tx.objectStore('data').get('user')
    req.onsuccess = () => {
      try {
        resolve(validate(req.result))
      } catch (e) {
        reject(e)
      }
    }
    req.onerror = () => reject(new Error('本地数据读取失败。'))
  })
}
/** Read-modify-write in one transaction, also serializing writes from different tabs. */
export async function updateUser(
  transform: (user: UserData) => UserData,
): Promise<UserData> {
  const db = await open()
  return new Promise((resolve, reject) => {
    const tx = db.transaction('data', 'readwrite'),
      store = tx.objectStore('data'),
      req = store.get('user')
    let next: UserData, problem: unknown
    req.onsuccess = () => {
      try {
        next = transform(validate(req.result))
        store.put(next, 'user')
      } catch (e) {
        problem = e
        tx.abort()
      }
    }
    tx.oncomplete = () => {
      resolve(next)
      if ('BroadcastChannel' in globalThis) {
        const channel = new BroadcastChannel('deepcook-updates')
        channel.postMessage('updated')
        channel.close()
      }
    }
    tx.onabort = tx.onerror = () =>
      reject(
        problem ??
          new Error('保存失败，请检查浏览器可用空间；原数据和当前输入仍保留。'),
      )
  })
}
export async function imageData(file: File, max = 1200): Promise<string> {
  if (!/^image\/(jpeg|png|webp)$/.test(file.type))
    throw new Error('请选择 JPG、PNG 或 WebP 图片。')
  if (file.size > 20 * 1024 * 1024) throw new Error('请选择小于 20 MB 的图片。')
  const bitmap = await createImageBitmap(file)
  try {
    const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height)),
      canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(bitmap.width * scale))
    canvas.height = Math.max(1, Math.round(bitmap.height * scale))
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('当前浏览器无法处理图片。')
    ctx.fillStyle = '#f3ede0'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
    return canvas.toDataURL('image/jpeg', 0.85)
  } finally {
    bitmap.close()
  }
}
