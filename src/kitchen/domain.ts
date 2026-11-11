import type { Filter, Recipe, UserData } from './types'
import { privateImageUrl } from './api.ts'

export const DEFAULT_PREFERENCES: UserData['preferences'] = {
  theme: 'system',
  readingSize: 'standard',
  showStepImages: true,
  keepScreenOn: false,
}
export const emptyUser = (): UserData => ({
  favorites: [],
  recent: [],
  recipes: [],
  profile: { name: '', avatar: null, likes: [], avoids: [] },
  preferences: { ...DEFAULT_PREFERENCES },
})
export const visible = (value?: string | null) =>
  Boolean(value?.trim() && value.trim() !== '无')
export const lines = (values: string[]) => values.filter(visible)
export const isMine = (recipe: Recipe) => recipe.id.startsWith('user-')
export const publicUrl = (path: string) =>
  new URL(`../${path}`, document.baseURI).href
export const assetUrl = (path?: string | null): string | undefined => {
  if (!path) return undefined
  if (path.startsWith('/deepcook-api/')) return privateImageUrl(path)
  if (/^data:image\/(jpeg|png|webp);base64,/.test(path)) return path
  if (
    !/^photos\/(?:[\w-]+\/)*[\w.-]+\.(jpg|jpeg|png|webp)$/.test(path) ||
    path.split('/').some((p) => p === '.' || p === '..')
  )
    return undefined
  return publicUrl(`catalog/${path}`)
}
export const safeUrl = (url?: string | null) => {
  try {
    const parsed = new URL(url ?? '')
    return parsed.protocol === 'https:' || parsed.protocol === 'http:'
      ? parsed.href
      : undefined
  } catch {
    return undefined
  }
}
export function filterRecipes(recipes: Recipe[], filter: Filter) {
  const terms = filter.query.trim().toLowerCase().split(/\s+/).filter(Boolean)
  return recipes.filter((r) => {
    const haystack = [
      r.title,
      r.region,
      ...(r.aliases ?? []),
      ...r.categories,
      ...r.ingredients.map((i) => i.name),
    ].map((s) => s.toLowerCase())
    return (
      terms.every((t) => haystack.some((s) => s.includes(t))) &&
      (filter.category === '全部' ||
        r.region === filter.category ||
        r.categories.includes(filter.category)) &&
      (!filter.difficulty || r.difficulty === Number(filter.difficulty)) &&
      (!filter.time ||
        (r.minutes != null &&
          (filter.time === 'long'
            ? r.minutes > 60
            : r.minutes <= Number(filter.time))))
    )
  })
}
const synonyms = [
  ['西红柿', '番茄'],
  ['马铃薯', '土豆'],
  ['洋芋', '土豆'],
  ['番薯', '红薯'],
  ['地瓜', '红薯'],
  ['青椒', '柿子椒'],
  ['圆白菜', '卷心菜'],
  ['包菜', '卷心菜'],
  ['鸡子', '鸡蛋'],
]
export function canonical(value: string) {
  return synonyms.reduce(
    (s, [from, to]) => s.replaceAll(from!, to!),
    value.toLowerCase().replace(/[^\p{L}\p{N}]/gu, ''),
  )
}
function overlap(a: string, b: string) {
  if (a === b) return 1
  if (a.length < 2 || b.length < 2) return 0
  const grams = (s: string) => {
    const map = new Map<string, number>()
    for (let i = 0; i < s.length - 1; i++) {
      const g = s.slice(i, i + 2)
      map.set(g, (map.get(g) ?? 0) + 1)
    }
    return map
  }
  const left = grams(a),
    right = grams(b)
  return (
    (2 *
      [...left].reduce(
        (n, [key, count]) => n + Math.min(count, right.get(key) ?? 0),
        0,
      )) /
    (a.length + b.length - 2)
  )
}
export function matchName<T extends { name: string }>(
  query: string,
  entries: T[],
): T | undefined {
  const name = canonical(query)
  if (!name) return
  const exact = entries.find((e) => canonical(e.name) === name)
  if (exact) return exact
  const contained = entries
    .filter((e) => {
      const n = canonical(e.name)
      return (
        Math.min(n.length, name.length) >= 2 &&
        (n.includes(name) || name.includes(n))
      )
    })
    .sort(
      (a, b) =>
        Math.abs(canonical(a.name).length - name.length) -
        Math.abs(canonical(b.name).length - name.length),
    )[0]
  return (
    contained ??
    entries
      .map((entry) => ({ entry, score: overlap(name, canonical(entry.name)) }))
      .filter((e) => e.score >= 0.55)
      .sort((a, b) => b.score - a.score)[0]?.entry
  )
}
export function recordVisit(data: UserData, id: string): UserData {
  return {
    ...data,
    recent: [
      { recipeId: id, timestamp: Date.now() },
      ...data.recent.filter((r) => r.recipeId !== id),
    ].slice(0, 50),
  }
}
export function validRecipe(value: unknown): value is Recipe {
  if (!value || typeof value !== 'object') return false
  const r = value as Recipe
  return (
    typeof r.id === 'string' &&
    typeof r.title === 'string' &&
    typeof r.description === 'string' &&
    typeof r.region === 'string' &&
    typeof r.servings === 'string' &&
    Array.isArray(r.categories) &&
    r.categories.every((v) => typeof v === 'string') &&
    Array.isArray(r.aliases ?? []) &&
    (r.aliases ?? []).every((v) => typeof v === 'string') &&
    [r.preparation, r.notes].every(
      (a) => Array.isArray(a) && a.every((v) => typeof v === 'string'),
    ) &&
    Array.isArray(r.ingredients) &&
    r.ingredients.length > 0 &&
    r.ingredients.every(
      (i) =>
        typeof i.id === 'string' &&
        typeof i.name === 'string' &&
        typeof i.amount === 'string',
    ) &&
    Array.isArray(r.steps) &&
    r.steps.length > 0 &&
    r.steps.every(
      (s) =>
        typeof s.id === 'string' &&
        typeof s.title === 'string' &&
        typeof s.text === 'string',
    ) &&
    Boolean(
      r.source &&
      typeof r.source.author === 'string' &&
      typeof r.source.license === 'string',
    ) &&
    (r.minutes == null || (Number.isInteger(r.minutes) && r.minutes > 0)) &&
    (r.difficulty == null ||
      (Number.isInteger(r.difficulty) &&
        r.difficulty >= 1 &&
        r.difficulty <= 5))
  )
}
