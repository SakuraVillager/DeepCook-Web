import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, existsSync } from 'node:fs'
import {
  filterRecipes,
  matchName,
  recordVisit,
  emptyUser,
  validRecipe,
  visible,
  assetUrl,
  publicUrl,
  safeUrl,
} from '../src/kitchen/domain.ts'

const recipes = JSON.parse(
  readFileSync(new URL('../public/catalog/recipes.json', import.meta.url)),
)
const filter = (patch = {}) => ({
  query: '',
  category: '全部',
  time: '',
  difficulty: '',
  ...patch,
})
test('all bundled recipes have unique stable identifiers and valid referenced files', () => {
  assert.equal(new Set(recipes.map((r) => r.id)).size, recipes.length)
  for (const recipe of recipes) {
    assert.ok(validRecipe(recipe), recipe.id)
    assert.equal(
      new Set(recipe.steps.map((s) => s.id)).size,
      recipe.steps.length,
    )
    for (const path of [
      recipe.cover,
      ...recipe.steps.map((s) => s.image),
    ].filter(Boolean))
      assert.ok(
        existsSync(new URL(`../public/catalog/${path}`, import.meta.url)),
        path,
      )
  }
})
test('multiword search matches every term across name, alias and ingredients', () => {
  const r = {
    ...recipes[0],
    title: '番茄鸡蛋面',
    aliases: ['西红柿面'],
    ingredients: [{ id: 'i1', name: '鸡蛋', amount: '2 个' }],
  }
  assert.equal(filterRecipes([r], filter({ query: '西红柿 鸡蛋' })).length, 1)
  assert.equal(filterRecipes([r], filter({ query: '西红柿 牛肉' })).length, 0)
})
test('region, time and difficulty compose; unknown time is excluded from bounded filters', () => {
  const r = { ...recipes[0], region: '中式', minutes: 30, difficulty: 2 }
  assert.equal(
    filterRecipes(
      [r],
      filter({ category: '中式', time: '30', difficulty: '2' }),
    ).length,
    1,
  )
  assert.equal(filterRecipes([r], filter({ category: '日式' })).length, 0)
  assert.equal(
    filterRecipes([{ ...r, minutes: null }], filter({ time: '30' })).length,
    0,
  )
  assert.equal(
    filterRecipes([{ ...r, minutes: 61 }], filter({ time: 'long' })).length,
    1,
  )
})
test('lookup folds synonyms and prefers exact or closest contained names', () => {
  const entries = ['番茄炒蛋', '冬瓜排骨汤', '排骨'].map((name) => ({ name }))
  assert.equal(matchName('西红柿炒蛋', entries)?.name, '番茄炒蛋')
  assert.equal(matchName('冬瓜排骨', entries)?.name, '冬瓜排骨汤')
  assert.equal(matchName('完全无关菜名', entries), undefined)
})
test('recent history deduplicates and caps at fifty records', () => {
  let d = emptyUser()
  for (let i = 0; i < 55; i++) d = recordVisit(d, `r${i}`)
  d = recordVisit(d, 'r20')
  assert.equal(d.recent.length, 50)
  assert.equal(d.recent[0].recipeId, 'r20')
  assert.equal(d.recent.filter((v) => v.recipeId === 'r20').length, 1)
})
test('unknown optional text remains hidden and invalid records are rejected', () => {
  assert.equal(visible(' 无 '), false)
  assert.equal(visible('小火慢炖'), true)
  assert.equal(validRecipe({ ...recipes[0], steps: null }), false)
})

test('asset URLs preserve deployment prefixes and nested catalog folders', () => {
  globalThis.document = {
    baseURI: 'https://example.test/deepcook/app/index.html',
  }
  assert.equal(
    publicUrl('catalog/recipes.json'),
    'https://example.test/deepcook/catalog/recipes.json',
  )
  assert.equal(
    assetUrl('photos/generated-favorites/dish.png'),
    'https://example.test/deepcook/catalog/photos/generated-favorites/dish.png',
  )
  assert.equal(assetUrl('photos/../secret.jpg'), undefined)
  assert.equal(safeUrl('javascript:alert(1)'), undefined)
  for (const recipe of recipes)
    for (const path of [
      recipe.cover,
      ...recipe.steps.map((s) => s.image),
    ].filter(Boolean))
      assert.ok(assetUrl(path), path)
  delete globalThis.document
})
