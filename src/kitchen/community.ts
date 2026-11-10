import type { Recipe } from './types'

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
}
export interface RecipeCommunity {
  nutrition: Nutrition | null
  ownRating: number | null
  ratings: number[]
  posts: KitchenPost[]
  sampleRatings: number
}
export interface Nutrition {
  calories: number | null
  fat: number | null
  protein: number | null
  carbs: number | null
  fiber: number | null
  sodium: number | null
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
        !(p.photo === null || (p.submission && p.photo === p.id)),
    ) ||
    new Set(r.posts.map((p) => p.id)).size !== r.posts.length
  ) {
    throw new Error('本地互动记录暂时无法读取，原数据已保留。')
  }
  return r
}
export function communityWithSamples(
  record: CommunityRecord,
  recipe: Recipe,
  catalog: Recipe[],
): RecipeCommunity {
  const index = catalog.findIndex((r) => r.id === recipe.id)
  const seeded = index >= 0 && (index < 12 || recipe.featured)
  const samples: KitchenPost[] = seeded
    ? [
        {
          id: `example-work-${recipe.id}`,
          recipeId: recipe.id,
          submission: true,
          text: '第一次尝试，记录一下这次的成品。',
          photo: recipe.cover ?? null,
          author: '阿米',
          sample: true,
          createdAt: 1700000000001,
        },
        {
          id: `example-comment-${recipe.id}`,
          recipeId: recipe.id,
          submission: false,
          text: '下次想试试这个做法。',
          photo: null,
          author: '小禾',
          sample: true,
          createdAt: 1700000000000,
        },
      ]
    : []
  return {
    nutrition: seeded
      ? {
          calories: 480,
          fat: 22,
          protein: 26,
          carbs: 44,
          fiber: 3.5,
          sodium: 650,
        }
      : null,
    ownRating: record.ownRating,
    ratings: [
      ...(seeded ? [8, 9, 6] : []),
      ...(record.ownRating === null ? [] : [record.ownRating]),
    ],
    sampleRatings: seeded ? 3 : 0,
    posts: [...record.posts, ...samples].sort(
      (a, b) => b.createdAt - a.createdAt || b.id.localeCompare(a.id),
    ),
  }
}
export function ratingSummary(ratings: number[]) {
  return {
    average: ratings.length
      ? ratings.reduce((a, b) => a + b, 0) / ratings.length
      : null,
    groups: [
      { name: '好极了', min: 8, max: 10 },
      { name: '挺好', min: 6, max: 7 },
      { name: '一般', min: 1, max: 5 },
    ].map((g) => ({
      ...g,
      count: ratings.filter((s) => s >= g.min && s <= g.max).length,
    })),
  }
}
