import type { Recipe } from './types'
import { recipeNutrition } from './nutrition.ts'
import type { Nutrition } from './nutrition.ts'
export type { Nutrition } from './nutrition.ts'

export type ComposerKind = 'rating' | 'comment' | 'submission'
export interface KitchenPost {
  id: string
  recipeId: string
  submission: boolean
  text: string
  photo: string | null
  author: string
  sample: boolean
  createdAt: number
  mine?: boolean
  cloud?: boolean
  localOnly?: boolean
  photoUrl?: string | null
  photoPending?: boolean
}
export interface CommunityRecord {
  schema: 1
  recipeId: string
  ownRating: number | null
  posts: KitchenPost[]
}
export interface CommunityDraft {
  kind: ComposerKind
  text: string
  score: number
  photo: Blob | null
  postId?: string
}
export interface RecipeCommunity {
  nutrition: Nutrition | null
  ownRating: number | null
  ratings: number[]
  posts: KitchenPost[]
  ratingCounts?: number[]
  postCounts?: { comment: number; submission: number }
  localRating?: number | null
}
export const emptyCommunity = (recipeId: string): CommunityRecord => ({
  schema: 1,
  recipeId,
  ownRating: null,
  posts: [],
})
export function validScore(score: unknown): score is number {
  return (
    typeof score === 'number' &&
    Number.isInteger(score) &&
    score >= 1 &&
    score <= 10
  )
}
export function validatePostText(text: string) {
  if (!text.trim()) throw new Error('请先写下评论或下厨心得。')
  if (text.length > 2000) throw new Error('内容最多 2000 字。')
  return text.trim()
}
export function validateCommunity(
  value: unknown,
  recipeId: string,
): CommunityRecord {
  if (value === undefined) return emptyCommunity(recipeId)
  const r = value as CommunityRecord
  if (
    !r ||
    r.schema !== 1 ||
    r.recipeId !== recipeId ||
    !(r.ownRating === null || validScore(r.ownRating)) ||
    !Array.isArray(r.posts) ||
    r.posts.some(
      (p) =>
        !p ||
        typeof p.id !== 'string' ||
        !p.id.startsWith('post-') ||
        p.recipeId !== recipeId ||
        p.sample !== false ||
        typeof p.submission !== 'boolean' ||
        typeof p.text !== 'string' ||
        !p.text.trim() ||
        p.text.length > 2000 ||
        typeof p.author !== 'string' ||
        !p.author.trim() ||
        !Number.isSafeInteger(p.createdAt) ||
        p.createdAt < 0 ||
        p.createdAt > 8640000000000000 ||
        !(
          p.photo === null ||
          (p.submission &&
            (p.photo === p.id || (p.cloud === true && isCloudPhoto(p.photo))))
        ),
    ) ||
    new Set(r.posts.map((p) => p.id)).size !== r.posts.length
  ) {
    throw new Error('本地互动记录暂时无法读取，原数据已保留。')
  }
  return r
}
export function isCloudPhoto(path: unknown): path is string {
  return (
    typeof path === 'string' &&
    /^\/deepcook-api\/v1\/photos\/[a-f0-9]{64}\.jpg$/.test(path)
  )
}
export function recipeCommunity(
  record: CommunityRecord,
  recipe: Recipe,
  _catalog: Recipe[],
): RecipeCommunity {
  return {
    nutrition: recipeNutrition(recipe),
    ownRating: record.ownRating,
    ratings: record.ownRating === null ? [] : [record.ownRating],
    posts: [...record.posts].sort(
      (a, b) => b.createdAt - a.createdAt || b.id.localeCompare(a.id),
    ),
  }
}
export function ratingSummary(ratings: number[], remoteCounts: number[] = []) {
  const count = ratings.length + remoteCounts.reduce((a, b) => a + b, 0)
  return {
    count,
    average: count
      ? (ratings.reduce((a, b) => a + b, 0) +
          remoteCounts.reduce((sum, n, i) => sum + n * (i + 1), 0)) /
        count
      : null,
    groups: [
      { name: '好极了', min: 8, max: 10 },
      { name: '挺好', min: 6, max: 7 },
      { name: '一般', min: 1, max: 5 },
    ].map((g) => ({
      ...g,
      count:
        ratings.filter((s) => s >= g.min && s <= g.max).length +
        remoteCounts.reduce(
          (sum, n, i) => sum + (i + 1 >= g.min && i + 1 <= g.max ? n : 0),
          0,
        ),
    })),
  }
}
