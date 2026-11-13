import estimates from '../data/nutrition-estimates.json' with { type: 'json' }
import type { Recipe } from './types'

export interface Nutrition {
  calories: number | null
  fat: number | null
  protein: number | null
  carbs: number | null
  fiber: number | null
  sodium: number | null
  basis: 'serving' | 'recipe'
  servings: number | null
  note: string
}

type Entry = { recipeKey: string[]; values: Nutrition }
const entries = estimates.recipes as Record<string, Entry>

export function recipeNutrition(recipe: Recipe): Nutrition | null {
  const entry = entries[recipe.id]
  if (!entry) return null
  const key = [
    recipe.servings,
    ...recipe.ingredients.flatMap((i) => [i.name, i.amount]),
  ]
  if (
    key.length !== entry.recipeKey.length ||
    key.some((value, i) => value !== entry.recipeKey[i])
  )
    return null
  return entry.values
}
