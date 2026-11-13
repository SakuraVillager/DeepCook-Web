import { useEffect, useState } from 'react'
import { useKitchen } from './context'
import type { FoodProfile } from './types'
import { Flip, Heading } from './ui'

const cuisines = ['中式家常', '川湘风味', '粤式风味', '江浙风味', '日韩料理', '东南亚菜', '西式料理', '其他风味']
const spices = ['不吃辣', '微辣', '中辣', '重辣', '都可以']
const tastes = ['清淡', '鲜香', '酸甜', '浓郁', '都喜欢']
const diets = ['不限制', '蛋奶素', '纯素']
const allergens = ['牛奶及乳制品', '鸡蛋', '花生', '坚果', '大豆', '小麦', '鱼类', '虾蟹', '贝类', '芝麻']
const avoided = ['香菜', '葱', '蒜', '芹菜', '胡萝卜', '茄子', '蘑菇', '动物内脏', '牛肉', '羊肉', '猪肉']
const experience = ['刚开始学', '会做几道家常菜', '经常下厨']
const goals = ['找到今天吃什么', '学会做新菜', '快手解决一餐', '尝试不同风味', '记录自己的拿手菜']
const goalNotes = ['多一点日常做饭灵感', '从清晰的步骤开始', '优先发现省时的做法', '探索各地和世界料理', '整理、保存自己的做法']
const titles = ['你喜欢吃些什么？', '有什么需要避开？', '平时怎么下厨？', '想收获些什么？']
const descriptions = ['选一点你喜欢的，让找菜更合口味。', '忌口和不喜欢的食材，可以分开告诉我们。', '按你的节奏，找到更容易上手的菜。', '选几个小愿望，从今天的一餐开始。']

function toggle(items: string[], value: string, exclusive?: string) {
  if (exclusive === value) return items.includes(value) ? [] : [value]
  return [...new Set([...items.filter((item) => item !== exclusive), ...(items.includes(value) ? [] : [value])])]
}

export function FoodProfileSetup({ embedded = false }: { embedded?: boolean }) {
  const { user, commit, ready, go, notify } = useKitchen()
  const [profile, setProfile] = useState<FoodProfile>(user.foodSetup.draft ?? user.foodSetup.profile)
  const [page, setPage] = useState(0)
  const [busy, setBusy] = useState(false)
  const [customAllergen, setCustomAllergen] = useState('')
  const [customAvoid, setCustomAvoid] = useState('')
  useEffect(() => {
    setProfile(user.foodSetup.draft ?? user.foodSetup.profile)
    setPage(Math.min(3, user.foodSetup.page ?? 0))
  }, [user.foodSetup])
  const update = (transform: (current: FoodProfile) => FoodProfile) => setProfile(transform)
  const persistDraft = async (nextPage: number) => {
    setBusy(true)
    try {
      await commit((data) => ({ ...data, foodSetup: { ...data.foodSetup, draft: profile, page: nextPage } }))
      setPage(nextPage)
      if (!embedded) window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch { /* Context keeps the user's current selection visible. */ }
    finally { setBusy(false) }
  }
  const finish = async () => {
    setBusy(true)
    try {
      await commit((data) => ({ ...data, foodSetup: { profile, draft: null, page: 0, completed: true } }))
      notify('饮食偏好已保存，推荐会按你的选择调整。')
      if (!embedded) go('/discover')
    } catch { /* Context reports save errors. */ }
    finally { setBusy(false) }
  }
  const skip = async () => {
    setBusy(true)
    try {
      await commit((data) => ({ ...data, foodSetup: { ...data.foodSetup, profile, draft: null, page: 0, completed: true } }))
      if (!embedded) go('/discover')
    } catch { /* Context reports save errors. */ }
    finally { setBusy(false) }
  }
  const chips = (options: string[], selected: string[], onToggle: (value: string) => void) => (
    <div className="k-tags k-food-chips">{options.map((option) => <button type="button" key={option} className={selected.includes(option) ? 'active' : ''} aria-pressed={selected.includes(option)} onClick={() => onToggle(option)}>{option}</button>)}</div>
  )
  const addChip = (kind: 'allergen' | 'avoided') => {
    const value = (kind === 'allergen' ? customAllergen : customAvoid).trim()
    if (!value) return
    update((p) => kind === 'allergen'
      ? { ...p, allergens: [...new Set([...(p.allergens ?? []), value])] }
      : { ...p, avoided: [...new Set([...p.avoided, value])] })
    kind === 'allergen' ? setCustomAllergen('') : setCustomAvoid('')
  }
  if (!ready) return <div className="k-loading-placeholder" aria-label="正在读取饮食偏好" />
  return <section className={`k-food-setup${embedded ? ' k-food-setup--embedded' : ''}`}>
    {!embedded && <div className="k-breadcrumb"><Flip onClick={() => go('/settings')}>← 我的厨房</Flip></div>}
    {!embedded && <Heading index="05" en="YOUR FOOD PROFILE" title="让推荐更合你的口味。" />}
    <div className="k-food-setup__frame">
      <div className="k-food-progress" aria-label={`第 ${page + 1} 页，共 4 页`}>{titles.map((_, i) => <span key={i} className={i <= page ? 'active' : ''} />)}<button type="button" disabled={busy} onClick={() => void skip()}>跳过设置</button></div>
      <div className="k-food-setup__top"><div><span className="label">认识你的口味 · {page + 1}/4</span><h2>{titles[page]}</h2><p>{descriptions[page]}</p></div><span className="k-food-setup__mark">0{page + 1}</span></div>
      {page === 0 && <div className="k-food-groups">
        <fieldset><legend>喜欢哪些菜系？ <small>可多选</small></legend>{chips(cuisines, profile.cuisines, (v) => update((p) => ({ ...p, cuisines: toggle(p.cuisines, v) })))}</fieldset>
        <fieldset><legend>平时吃多辣？ <small>选一项，也可以不选</small></legend>{chips(spices, profile.spice ? [profile.spice] : [], (v) => update((p) => ({ ...p, spice: p.spice === v ? null : v })))}</fieldset>
        <fieldset><legend>偏爱哪些味道？ <small>可多选</small></legend>{chips(tastes, profile.tastes, (v) => update((p) => ({ ...p, tastes: toggle(p.tastes, v, '都喜欢') })))}</fieldset>
      </div>}
      {page === 1 && <div className="k-food-groups">
        <fieldset><legend>有固定的饮食方式吗？</legend>{chips(diets, profile.diet ? [profile.diet] : [], (v) => update((p) => ({ ...p, diet: p.diet === v ? null : v })))}</fieldset>
        <fieldset><legend>有过敏或不耐受的食材吗？ <small>与普通忌口分开记录</small></legend>{chips([...allergens, ...(profile.allergens ?? []).filter((v) => !allergens.includes(v)), '没有已知项'], profile.allergens?.length === 0 ? ['没有已知项'] : profile.allergens ?? [], (v) => update((p) => ({ ...p, allergens: v === '没有已知项' ? (p.allergens?.length === 0 ? null : []) : (p.allergens ?? []).filter((x) => x !== '没有已知项').includes(v) ? (p.allergens ?? []).filter((x) => x !== v) : [...(p.allergens ?? []).filter((x) => x !== '没有已知项'), v] })))}<div className="k-food-add"><input aria-label="添加过敏食材" placeholder="添加需要避开的食材" value={customAllergen} onChange={(e) => setCustomAllergen(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addChip('allergen')} /><button type="button" onClick={() => addChip('allergen')}>添加</button></div></fieldset>
        <fieldset><legend>有不喜欢或不吃的食材吗？ <small>可多选，也可以自己添加</small></legend>{chips([...avoided, ...profile.avoided.filter((v) => !avoided.includes(v))], profile.avoided, (v) => update((p) => ({ ...p, avoided: p.avoided.includes(v) ? p.avoided.filter((x) => x !== v) : [...p.avoided, v] })))}<div className="k-food-add"><input aria-label="添加忌口食材" placeholder="添加其他忌口" value={customAvoid} onChange={(e) => setCustomAvoid(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addChip('avoided')} /><button type="button" onClick={() => addChip('avoided')}>添加</button></div></fieldset>
        <p className="k-food-safety">推荐会按已记录的材料避开相关菜谱，材料信息可能不完整；下厨前请核对实际食材及调料。</p>
      </div>}
      {page === 2 && <div className="k-food-groups">
        <fieldset><legend>你的下厨经验？</legend>{chips(experience, profile.experience ? [profile.experience] : [], (v) => update((p) => ({ ...p, experience: p.experience === v ? null : v })))}</fieldset>
        <fieldset><legend>通常愿意花多久？</legend>{chips(['15 min 内', '30 min 内', '60 min 内', '时间不限'], profile.minutes == null ? [] : [profile.minutes === 0 ? '时间不限' : `${profile.minutes} min 内`], (v) => update((p) => ({ ...p, minutes: v === '时间不限' ? (p.minutes === 0 ? null : 0) : (p.minutes === Number.parseInt(v) ? null : Number.parseInt(v)) })))}</fieldset>
        <fieldset><legend>通常给几个人做饭？</legend>{chips(['1 人', '2 人', '3～4 人', '5 人及以上', '不固定'], profile.servings ? [profile.servings] : [], (v) => update((p) => ({ ...p, servings: p.servings === v ? null : v })))}</fieldset>
      </div>}
      {page === 3 && <fieldset className="k-food-goals"><legend>你想从 DeepCook 收获什么？ <small>可多选</small></legend><div className="k-tags k-food-chips">{goals.map((goal, i) => <button type="button" key={goal} className={profile.goals.includes(goal) ? 'active' : ''} aria-pressed={profile.goals.includes(goal)} title={goalNotes[i]} onClick={() => update((p) => ({ ...p, goals: toggle(p.goals, goal) }))}>{goal}</button>)}</div><p className="k-food-goal-notes">{profile.goals.map((goal) => goalNotes[goals.indexOf(goal)]).filter(Boolean).join(' · ')}</p></fieldset>}
      <div className="k-food-setup__actions">{page > 0 ? <button type="button" className="k-food-skip" disabled={busy} onClick={() => void persistDraft(page - 1)}>← 上一步</button> : <span /> }<button type="button" className="btn" disabled={busy} onClick={() => page < 3 ? void persistDraft(page + 1) : void finish()}>{busy ? '保存中…' : page < 3 ? '下一步 ↗' : '保存偏好，开始找菜 ↗'}</button></div>
      <p className="k-food-footnote">随时可在「我的厨房 · 饮食偏好」中修改</p>
    </div>
  </section>
}
