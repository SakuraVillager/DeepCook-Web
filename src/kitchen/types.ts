export interface Ingredient {
  id: string
  name: string
  amount: string
}
export interface Step {
  id: string
  order: number
  title: string
  text: string
  image?: string | null
  ingredientRefs?: string[]
  cue?: string | null
}
export interface Recipe {
  id: string
  version: number
  title: string
  region: string
  description: string
  cover?: string | null
  categories: string[]
  minutes: number | null
  difficulty: number | null
  servings: string
  ingredients: Ingredient[]
  preparation: string[]
  steps: Step[]
  notes: string[]
  source: {
    author: string
    license: string
    url?: string | null
    imageSource?: string | null
  }
  featured?: boolean
  aliases?: string[]
  collection?: string
}
export interface Filter {
  query: string
  category: string
  time: string
  difficulty: string
}
export interface SavedRecipe {
  recipeId: string
  timestamp: number
}
export interface Preferences {
  theme: 'system' | 'light' | 'dark'
  readingSize: 'standard' | 'large' | 'extra'
  showStepImages: boolean
  keepScreenOn: boolean
}
export interface UserData {
  favorites: SavedRecipe[]
  recent: SavedRecipe[]
  recipes: Recipe[]
  profile: {
    name: string
    avatar: string | null
    likes: string[]
    avoids: string[]
  }
  preferences: Preferences
}
export const REGIONS = [
  '中式',
  '日式',
  '韩式',
  '美式',
  '欧式',
  '东南亚',
  '其他',
  '无',
]
export const CATEGORIES = [
  '家常菜',
  '快手菜',
  '素食',
  '肉类',
  '海鲜',
  '汤羹',
  '主食',
  '面食',
  '烘焙甜点',
  '早餐',
  '沙拉',
  '甜点',
  '饮品',
  '酱料',
  '半成品',
  '国际菜',
  '炖菜',
  '烘焙',
]
export const LIKES = [
  '甜',
  '咸',
  '辣',
  '酸',
  '麻',
  '鲜',
  '清淡',
  '油炸',
  '汤羹',
  '下饭',
]
export const AVOIDS = [
  '辣',
  '香菜',
  '葱',
  '姜',
  '蒜',
  '海鲜',
  '花生',
  '牛肉',
  '羊肉',
  '内脏',
]
