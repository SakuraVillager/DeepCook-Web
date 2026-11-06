import { matchName, publicUrl } from './domain'
import type { Recipe } from './types'

type Index = {
  ref: string
  dishes: { name: string; path: string; group: string }[]
}
const clean = (s: string) =>
  s
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/[×*]\s*份数.*$/, '')
    .replace(/[*`]/g, '')
    .trim()
export function parseMarkdown(
  markdown: string,
  group: string,
  url: string,
): Recipe {
  const title = clean(markdown.match(/^# (.+)$/m)?.[1] ?? '')
    .replace(/的做法$/, '')
    .trim()
  const sections = [
    ...markdown.matchAll(/^## (.+)\r?\n([\s\S]*?)(?=^## |$(?![\s\S]))/gm),
  ].map((m) => ({ title: m[1]!, body: m[2]! }))
  const section = (names: string[]) =>
    sections.find((s) => names.some((n) => s.title.includes(n)))?.body ?? ''
  const amounts = section(['计算', '用量'])
    .split('\n')
    .flatMap((line) => {
      const body = clean(line.replace(/^\s*[-*+]\s+/, ''))
      const m =
        body.match(/^(.+?)\s*[=＝]\s*(.+)$/) ??
        body.match(/^(.+?)\s*([\d０-９].*|适量.*|少许.*)$/)
      return m ? [{ name: clean(m[1]!), amount: clean(m[2]!) }] : []
    })
  const ingredients = section(['必备原料', '原料', '食材', '用料'])
    .split('\n')
    .flatMap((line, i) => {
      const m = line.match(/^[-*+]\s+(.+)$/)
      if (!m) return []
      const name = clean(m[1]!)
      const amount =
        amounts.find((a) => name.includes(a.name) || a.name.includes(name))
          ?.amount ?? '无'
      return name ? [{ id: `i${i}`, name, amount }] : []
    })
  const steps: Recipe['steps'] = []
  for (const line of section(['操作', '步骤', '做法']).split('\n')) {
    const m = line.match(/^\d+[.、)．]\s*(.*)$/)
    if (m)
      steps.push({
        id: `lookup-s${steps.length + 1}`,
        order: steps.length + 1,
        title: `第 ${steps.length + 1} 步`,
        text: clean(m[1]!),
      })
    else if (line.trim() && steps.length) {
      const last = steps[steps.length - 1]!
      if (/^\s{2,}[-*+\d]/.test(line))
        last.cue = [last.cue, clean(line.replace(/^\s*[-*+]\s*/, ''))]
          .filter(Boolean)
          .join('\n')
      else last.text += `\n${clean(line)}`
    }
  }
  const categories: Record<string, string> = {
    aquatic: '海鲜',
    meat_dish: '肉类',
    vegetable_dish: '素食',
    soup: '汤羹',
    staple: '主食',
    breakfast: '早餐',
    dessert: '甜点',
    drink: '饮品',
    condiment: '酱料',
    'semi-finished': '半成品',
  }
  const intro =
    markdown
      .split(/^## /m)[0]!
      .split('\n')
      .map(clean)
      .find((s) => s && !s.startsWith('#') && !s.startsWith('预估')) ?? ''
  const time = intro.match(
    /(?:全程|总用时|预计制作时长|从头备菜到盛盘出锅|从备料到出锅)[^。\n\d]{0,16}(\d+)\s*(分钟|小时)/,
  )
  if (!title || !ingredients.length || !steps.length)
    throw new Error('这道菜的资料没能读懂，请手动填写。')
  return {
    id: '',
    version: 0,
    title,
    region: '无',
    description: intro,
    categories: [categories[group] ?? '家常菜'],
    minutes: time ? Number(time[1]) * (time[2] === '小时' ? 60 : 1) : null,
    difficulty: markdown.match(/预估烹饪难度[：:]\s*(★+)/)?.[1]?.length ?? null,
    servings:
      markdown
        .match(/一份[^\n。]*?够\s*(\d+(?:[-—~～]\d+)?)\s*个?人/)?.[1]
        ?.concat(' 人份') ?? '无',
    ingredients,
    steps,
    preparation: [],
    notes: section(['附加内容', '注意', '小贴士'])
      .split('\n')
      .map((s) => clean(s.replace(/^\s*[-*+]\s+/, '')))
      .filter(Boolean),
    source: {
      author: 'HowToCook',
      license: 'Unlicense · 按个人修改保存；未经试做验证。',
      url,
    },
    collection: '我的菜谱',
  }
}
export async function lookupRecipe(
  name: string,
  catalog: Recipe[],
  signal: AbortSignal,
): Promise<Recipe> {
  const match = matchName(
    name,
    catalog.flatMap((recipe) =>
      [recipe.title, ...(recipe.aliases ?? [])].map((name) => ({
        name,
        recipe,
      })),
    ),
  )
  if (match) return match.recipe
  const response = await fetch(publicUrl('catalog/howtocook_index.json'), {
    signal,
  })
  if (!response.ok)
    throw new Error('资料索引暂时无法读取，可以重试或手动填写。')
  const index = (await response.json()) as Index,
    entry = matchName(name, index.dishes)
  if (!entry) throw new Error('菜谱库里没有这道菜，可以手动填写。')
  if (!navigator.onLine)
    throw new Error('本地没有匹配资料，当前网络不可用，可以手动填写。')
  const url = `https://raw.githubusercontent.com/Anduin2017/HowToCook/${encodeURIComponent(index.ref)}/${entry.path.split('/').map(encodeURIComponent).join('/')}`
  try {
    const result = await fetch(url, {
      signal: AbortSignal.any([signal, AbortSignal.timeout(16000)]),
    })
    if (!result.ok) throw new Error('HTTP error')
    const text = await result.text()
    if (text.length > 1048576) throw new Error('资料过大')
    return parseMarkdown(text, entry.group, url)
  } catch (e) {
    if (signal.aborted) throw e
    throw new Error('联网补全暂时失败，可以重试或手动填写。')
  }
}
