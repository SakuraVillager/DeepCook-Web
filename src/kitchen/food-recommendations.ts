import type { FoodProfile, Recipe } from './types'

const aliases: Record<string, string[]> = {
  '牛奶及乳制品': ['奶', '乳', '黄油', '芝士', '奶酪'], 鸡蛋: ['蛋'], 花生: ['花生'],
  坚果: ['核桃', '杏仁', '腰果', '榛子', '松子', '开心果', '碧根果', '坚果'],
  大豆: ['大豆', '黄豆', '豆腐', '豆浆', '豆皮', '腐竹', '豆瓣', '豆豉', '酱油', '生抽', '老抽', '味噌'],
  小麦: ['小麦', '面粉', '面包', '面条', '意面', '通心粉', '酱油', '生抽', '老抽', '面筋'],
  鱼类: ['鱼', '鳝', '鳗'], 虾蟹: ['虾', '蟹'], 贝类: ['贝', '蛤', '蚝', '牡蛎', '蛏', '蚌', '贻', '鲍'],
  芝麻: ['芝麻', '香油', '麻油'], 蘑菇: ['蘑菇', '香菇', '口蘑', '金针菇', '杏鲍菇', '菌菇'],
  动物内脏: ['肝', '腰子', '猪肚', '牛肚', '肥肠', '鸡胗', '鸭胗', '内脏'],
  牛肉: ['牛肉', '牛腩', '牛排', '肥牛', '牛筋'], 羊肉: ['羊肉', '羊排', '羊腿'],
  猪肉: ['猪肉', '五花', '里脊', '排骨', '培根', '火腿', '猪油', '肉末', '肉馅'],
}
const has = (value: string, terms: string[]) => terms.some((term) => value.includes(term))

export function hasFoodAnswers(profile: FoodProfile) {
  return profile.cuisines.length > 0 || profile.spice != null || profile.tastes.length > 0 ||
    profile.diet != null || profile.allergens != null || profile.avoided.length > 0 ||
    profile.experience != null || profile.minutes != null || profile.servings != null || profile.goals.length > 0
}

export function matchesFoodExclusions(recipe: Recipe, profile: FoodProfile) {
  const names = recipe.ingredients.map((item) => item.name.trim())
  const restricted = Boolean(profile.allergens?.length || profile.avoided.length || ['蛋奶素', '纯素'].includes(profile.diet ?? ''))
  if (restricted && (!names.length || names.some((name) => !name || name === '无'))) return false
  const excluded = [...(profile.allergens ?? []), ...profile.avoided]
  if (excluded.some((term) => names.some((name) => has(name, aliases[term] ?? [term])))) return false
  const spicyTerms = ['辣椒', '小米椒', '干辣椒', '辣酱', '豆瓣酱']
  if (profile.spice === '不吃辣' && names.some((name) => has(name, spicyTerms))) return false
  if (['蛋奶素', '纯素'].includes(profile.diet ?? '')) {
    const animals = ['肉', '猪', '牛腩', '牛排', '肥牛', '羊', '鸡', '鸭', '鹅', '鱼', '虾', '蟹', '贝', '蚝', '蛤', '蛏', '鲍', '排骨', '培根', '火腿', '明胶', '猪油']
    if (names.some((name) => has(name.replaceAll('鸡蛋', '').replaceAll('鸭蛋', '').replaceAll('鹌鹑蛋', '').replaceAll('鸡腿菇', ''), animals))) return false
  }
  if (profile.diet === '纯素' && names.some((name) => has(name, ['蛋', '奶', '乳', '黄油', '芝士', '奶酪', '蜂蜜']))) return false
  return true
}

export function recommendRecipes(recipes: Recipe[], profile: FoodProfile) {
  if (!hasFoodAnswers(profile))
    return recipes.filter((recipe) => recipe.featured).slice(0, 6)
  const cuisineTerms: Record<string, string[]> = {
    '中式家常': ['中式'], '川湘风味': ['川', '湘', '麻婆', '宫保', '回锅', '辣子'],
    '粤式风味': ['粤', '广式', '白切', '清蒸', '煲'], '江浙风味': ['江浙', '杭', '浙', '苏式', '糖醋'],
    日韩料理: ['日式', '韩式'], 东南亚菜: ['东南亚'], 西式料理: ['美式', '欧式'], 其他风味: ['其他'],
  }
  const tasteTerms: Record<string, string[]> = {
    清淡: ['清蒸', '水煮', '清汤', '凉拌'], 鲜香: ['鲜', '菌菇', '香菇'], 酸甜: ['糖醋', '酸甜', '番茄', '柠檬'],
    浓郁: ['红烧', '咖喱', '奶油', '浓'],
  }
  return recipes.filter((recipe) => matchesFoodExclusions(recipe, profile)).map((recipe) => {
    const text = [recipe.title, recipe.description, recipe.region, ...recipe.ingredients.map((item) => item.name)].join(' ')
    let score = recipe.featured ? 1 : 0
    if (profile.cuisines.some((choice) => has(text, cuisineTerms[choice] ?? []))) score += 6
    if (profile.minutes != null && recipe.minutes != null && recipe.minutes <= profile.minutes) score += 4
    if (profile.experience === '刚开始学' && recipe.difficulty != null && recipe.difficulty <= 2) score += 4
    if (profile.goals.includes('快手解决一餐') && recipe.minutes != null && recipe.minutes <= 30) score += 4
    if (profile.goals.includes('学会做新菜') && recipe.difficulty != null && recipe.difficulty <= 2) score += 2
    if (profile.goals.includes('尝试不同风味') && !['中式', '无'].includes(recipe.region)) score += 2
    const spicy = recipe.ingredients.some((item) => has(item.name, ['辣椒', '小米椒', '干辣椒', '辣酱', '豆瓣酱']))
    if (profile.spice === '不吃辣' && spicy) score -= 12
    if (['中辣', '重辣'].includes(profile.spice ?? '') && spicy) score += 3
    const tasteTermsAll: Record<string, string[]> = { ...tasteTerms, 甜: ['甜', '糖'], 咸: ['咸'], 酸: ['酸', '醋', '柠檬'], 麻: ['麻', '花椒'], 辣: ['辣', '小米椒'], 鲜: ['鲜'], 油炸: ['炸'], 汤羹: ['汤', '羹'], 下饭: ['下饭'] }
    if (profile.tastes.some((taste) => has(text, tasteTermsAll[taste] ?? []))) score += 3
    return { recipe, score }
  }).sort((a, b) => b.score - a.score).slice(0, 6).map(({ recipe }) => recipe)
}
