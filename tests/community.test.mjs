import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  emptyCommunity,
  communityWithSamples,
  ratingSummary,
  validateCommunity,
  validScore,
  validatePostText,
} from '../src/kitchen/community.ts'
const catalog = JSON.parse(
  readFileSync(new URL('../public/catalog/recipes.json', import.meta.url)),
)
test('App seed rules preserve the three ratings and two identifiable example posts', () => {
  const first = catalog[0],
    content = communityWithSamples(emptyCommunity(first.id), first, catalog)
  assert.deepEqual(content.ratings, [8, 9, 6])
  assert.equal(content.posts.length, 2)
  assert.ok(content.posts.every((p) => p.sample))
  assert.equal(content.posts[0].author, '阿米')
  assert.deepEqual(content.nutrition, {
    calories: 480,
    fat: 22,
    protein: 26,
    carbs: 44,
    fiber: 3.5,
    sodium: 650,
  })
  const other = catalog.find((r, i) => i >= 12 && !r.featured)
  assert.deepEqual(
    communityWithSamples(emptyCommunity(other.id), other, catalog).ratings,
    [],
  )
  assert.equal(
    communityWithSamples(emptyCommunity(other.id), other, catalog).nutrition,
    null,
  )
  const personal = { ...first, id: 'user-test', featured: true }
  assert.equal(
    communityWithSamples(emptyCommunity(personal.id), personal, catalog)
      .nutrition,
    null,
  )
})
test('rating summary uses the App 8–10 / 6–7 / 1–5 breakdown', () => {
  const summary = ratingSummary([8, 9, 6, 10])
  assert.equal(summary.average, 8.25)
  assert.deepEqual(
    summary.groups.map((g) => g.count),
    [3, 1, 0],
  )
  assert.equal(ratingSummary([]).average, null)
  assert.equal(validScore(0), false)
  assert.equal(validScore(10), true)
  assert.equal(validScore(8.5), false)
})
test('post text trims whitespace, rejects blank or oversized content', () => {
  assert.equal(validatePostText('  这次成功了。  '), '这次成功了。')
  assert.throws(() => validatePostText(' \n '))
  assert.throws(() => validatePostText('字'.repeat(2001)))
})
test('invalid local data and copied sample posts are rejected without mutating input', () => {
  const record = emptyCommunity('r')
  assert.equal(validateCommunity(record, 'r'), record)
  const corrupt = { ...record, ownRating: 11 }
  const snapshot = JSON.stringify(corrupt)
  assert.throws(() => validateCommunity(corrupt, 'r'))
  assert.equal(JSON.stringify(corrupt), snapshot)
  const sample = communityWithSamples(
    emptyCommunity(catalog[0].id),
    catalog[0],
    catalog,
  ).posts[0]
  assert.throws(() =>
    validateCommunity(
      { ...emptyCommunity(sample.recipeId), posts: [sample] },
      sample.recipeId,
    ),
  )
})
