import { useEffect, useRef, useState } from 'react'
import { useKitchen } from './context'
import type { FoodProfile } from './types'

const cuisines = ['中式家常', '川湘风味', '粤式风味', '江浙风味', '日韩料理', '东南亚菜', '西式料理', '其他风味']
const spices = ['不吃辣', '微辣', '中辣', '重辣', '都可以']
const tastes = ['清淡', '鲜香', '酸甜', '浓郁', '都喜欢']
const diets = ['不限制', '蛋奶素', '纯素']
const allergens = ['牛奶及乳制品', '鸡蛋', '花生', '坚果', '大豆', '小麦', '鱼类', '虾蟹', '贝类', '芝麻']
const avoided = ['香菜', '葱', '蒜', '芹菜', '胡萝卜', '茄子', '蘑菇', '动物内脏', '牛肉', '羊肉', '猪肉']
const experience = ['刚开始学', '会做几道家常菜', '经常下厨']
const goals = ['找到今天吃什么', '学会做新菜', '快手解决一餐', '尝试不同风味', '记录自己的拿手菜']
const goalNotes = ['多一点日常做饭灵感', '从清晰的步骤开始', '优先发现省时的做法', '探索各地和世界料理', '整理、保存自己的做法']

function toggle(items: string[], value: string, exclusive?: string) {
  if (exclusive === value) return items.includes(value) ? [] : [value]
  return [...new Set([...items.filter((item) => item !== exclusive), ...(items.includes(value) ? [] : [value])])]
}

export function FoodProfileSetup() {
  const { user, commit } = useKitchen()
  const [profile, setProfile] = useState<FoodProfile>(user.foodSetup.draft ?? user.foodSetup.profile)
  const [customAllergen, setCustomAllergen] = useState('')
  const [customAvoid, setCustomAvoid] = useState('')
  const dirty = useRef(false)
  const profileRef = useRef(profile)
  profileRef.current = profile

  useEffect(() => {
    setProfile(user.foodSetup.draft ?? user.foodSetup.profile)
  }, [user.foodSetup])

  useEffect(() => {
    if (!dirty.current) return
    const timer = window.setTimeout(() => {
      const current = profileRef.current
      dirty.current = false
      void commit((data) => ({ ...data, foodSetup: { profile: current, draft: null, page: 0, completed: true } }))
        .catch(() => { dirty.current = true })
    }, 400)
    return () => window.clearTimeout(timer)
  }, [profile, commit])

  const update = (transform: (current: FoodProfile) => FoodProfile) => {
    dirty.current = true
    setProfile((current) => {
      const next = transform(current)
      profileRef.current = next
      return next
    })
  }
  const chips = (options: string[], selected: string[], onToggle: (value: string) => void) => (
    <div className="k-tags k-food-chips">
      {options.map((option) => (
        <button type="button" key={option} className={selected.includes(option) ? 'active' : ''} aria-pressed={selected.includes(option)} onClick={() => onToggle(option)}>
          {option}
        </button>
      ))}
    </div>
  )
  const addChip = (kind: 'allergen' | 'avoided') => {
    const value = (kind === 'allergen' ? customAllergen : customAvoid).trim()
    if (!value) return
    update((p) => kind === 'allergen'
      ? { ...p, allergens: [...new Set([...(p.allergens ?? []), value])] }
      : { ...p, avoided: [...new Set([...p.avoided, value])] })
    if (kind === 'allergen') setCustomAllergen('')
    else setCustomAvoid('')
  }
  const addInput = (kind: 'allergen' | 'avoided', value: string, setValue: (value: string) => void) => (
    <div className="k-food-add">
      <input
        aria-label={kind === 'allergen' ? '添加过敏食材' : '添加忌口食材'}
        placeholder={kind === 'allergen' ? '添加需要避开的食材' : '添加其他忌口'}
        value={value}
        onChange={(event) => setValue(event.target.value)}
        onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); addChip(kind) } }}
      />
      <button type="button" onClick={() => addChip(kind)}>添加</button>
    </div>
  )

  return (
    <section className="k-food-setup">
      <div className="k-food-setup__frame">
        <div className="k-food-groups">
          <fieldset>
            <legend>喜欢哪些菜系？ <small>可多选</small></legend>
            {chips(cuisines, profile.cuisines, (value) => update((p) => ({ ...p, cuisines: toggle(p.cuisines, value) })))}
          </fieldset>
          <fieldset>
            <legend>平时吃多辣？ <small>选一项，也可以不选</small></legend>
            {chips(spices, profile.spice ? [profile.spice] : [], (value) => update((p) => ({ ...p, spice: p.spice === value ? null : value })))}
          </fieldset>
          <fieldset>
            <legend>偏爱哪些味道？ <small>可多选</small></legend>
            {chips(tastes, profile.tastes, (value) => update((p) => ({ ...p, tastes: toggle(p.tastes, value, '都喜欢') })))}
          </fieldset>
          <fieldset>
            <legend>有固定的饮食方式吗？</legend>
            {chips(diets, profile.diet ? [profile.diet] : [], (value) => update((p) => ({ ...p, diet: p.diet === value ? null : value })))}
          </fieldset>
          <fieldset>
            <legend>有过敏或不耐受的食材吗？ <small>与普通忌口分开记录</small></legend>
            {chips(
              [...allergens, ...(profile.allergens ?? []).filter((value) => !allergens.includes(value)), '没有已知项'],
              profile.allergens?.length === 0 ? ['没有已知项'] : profile.allergens ?? [],
              (value) => update((p) => ({
                ...p,
                allergens: value === '没有已知项'
                  ? (p.allergens?.length === 0 ? null : [])
                  : (p.allergens ?? []).filter((item) => item !== '没有已知项').includes(value)
                    ? (p.allergens ?? []).filter((item) => item !== value)
                    : [...(p.allergens ?? []).filter((item) => item !== '没有已知项'), value],
              })),
            )}
            {addInput('allergen', customAllergen, setCustomAllergen)}
          </fieldset>
          <fieldset>
            <legend>有不喜欢或不吃的食材吗？ <small>可多选，也可以自己添加</small></legend>
            {chips([...avoided, ...profile.avoided.filter((value) => !avoided.includes(value))], profile.avoided, (value) => update((p) => ({ ...p, avoided: p.avoided.includes(value) ? p.avoided.filter((item) => item !== value) : [...p.avoided, value] })))}
            {addInput('avoided', customAvoid, setCustomAvoid)}
          </fieldset>
          <p className="k-food-safety">推荐会按已记录的材料避开相关菜谱，材料信息可能不完整；下厨前请核对实际食材及调料。</p>
          <fieldset>
            <legend>你的下厨经验？</legend>
            {chips(experience, profile.experience ? [profile.experience] : [], (value) => update((p) => ({ ...p, experience: p.experience === value ? null : value })))}
          </fieldset>
          <fieldset>
            <legend>通常愿意花多久？</legend>
            {chips(['15 min 内', '30 min 内', '60 min 内', '时间不限'], profile.minutes == null ? [] : [profile.minutes === 0 ? '时间不限' : `${profile.minutes} min 内`], (value) => update((p) => ({ ...p, minutes: value === '时间不限' ? (p.minutes === 0 ? null : 0) : (p.minutes === Number.parseInt(value) ? null : Number.parseInt(value)) })))}
          </fieldset>
          <fieldset>
            <legend>通常给几个人做饭？</legend>
            {chips(['1 人', '2 人', '3～4 人', '5 人及以上', '不固定'], profile.servings ? [profile.servings] : [], (value) => update((p) => ({ ...p, servings: p.servings === value ? null : value })))}
          </fieldset>
          <fieldset>
            <legend>你想从 DeepCook 收获什么？ <small>可多选</small></legend>
            {chips(goals, profile.goals, (value) => update((p) => ({ ...p, goals: toggle(p.goals, value) })))}
            <p className="k-food-goal-notes">{profile.goals.map((goal) => goalNotes[goals.indexOf(goal)]).filter(Boolean).join(' · ')}</p>
          </fieldset>
        </div>
      </div>
    </section>
  )
}
