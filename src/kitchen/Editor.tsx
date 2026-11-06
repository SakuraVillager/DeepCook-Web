import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useKitchen } from './context'
import { isMine, validRecipe, visible } from './domain'
import { lookupRecipe } from './lookup'
import { imageData } from './storage'
import { CATEGORIES, REGIONS, type Recipe } from './types'
import { Empty, Flip, Heading, Photo } from './ui'

const ingredient = () => ({
  id: `i-${crypto.randomUUID()}`,
  name: '',
  amount: '',
})
const step = () => ({
  id: `s-${crypto.randomUUID()}`,
  order: 1,
  title: '',
  text: '',
  cue: '',
})
export const blankRecipe = (id = `user-${crypto.randomUUID()}`): Recipe => ({
  id,
  version: 0,
  title: '',
  region: '无',
  description: '',
  categories: [],
  minutes: null,
  difficulty: null,
  servings: '',
  ingredients: [ingredient()],
  preparation: [],
  steps: [step()],
  notes: [],
  source: {
    author: '我的菜谱',
    license: '由你自己添加的菜谱，仅保存在当前浏览器。',
  },
  collection: '我的菜谱',
})
export function fillBlanks(current: Recipe, filled: Recipe): Recipe {
  return {
    ...current,
    region: current.region === '无' ? filled.region : current.region,
    categories: current.categories.length
      ? current.categories
      : filled.categories,
    minutes: current.minutes ?? filled.minutes,
    difficulty: current.difficulty ?? filled.difficulty,
    servings: visible(current.servings)
      ? current.servings
      : visible(filled.servings)
        ? filled.servings
        : '',
    description: current.description.trim()
      ? current.description
      : filled.description,
    ingredients: current.ingredients.some(
      (i) => i.name.trim() || i.amount.trim(),
    )
      ? current.ingredients
      : filled.ingredients.map((i) => ({ ...i })),
    steps: current.steps.some(
      (s) => s.title.trim() || s.text.trim() || s.cue?.trim(),
    )
      ? current.steps
      : filled.steps.map((s) => ({ ...s })),
    preparation: current.preparation.some(visible)
      ? current.preparation
      : filled.preparation,
    notes: current.notes.some(visible) ? current.notes : filled.notes,
    source: current.source.url
      ? current.source
      : {
          ...filled.source,
          license: `${filled.source.license} · 按个人修改保存；请核对资料，未经试做验证。`,
        },
    aliases: current.aliases?.length ? current.aliases : filled.aliases,
  }
}
export function Editor({ id }: { id: string }) {
  const { user, catalog, commit, go, notify, guard, ready } = useKitchen()
  const existing = user.recipes.find((r) => r.id === id),
    key = `deepcook-draft-${id}`
  const [draft, setDraft] = useState<Recipe>(() => {
    try {
      const value: unknown = JSON.parse(sessionStorage.getItem(key) ?? 'null')
      if (validRecipe(value) && isMine(value)) return value
    } catch {
      /* Preserve unusable draft, start from last saved recipe. */
    }
    return existing ? structuredClone(existing) : blankRecipe()
  })
  const [dirty, setDirty] = useState(() => {
    try {
      return Boolean(sessionStorage.getItem(key))
    } catch {
      return false
    }
  })
  const [busy, setBusy] = useState(false),
    [importing, setImporting] = useState(false),
    [looking, setLooking] = useState(false),
    [errors, setErrors] = useState<string[]>([]),
    [notice, setNotice] = useState('')
  const lookup = useRef<AbortController | null>(null),
    mounted = useRef(true),
    warned = useRef(false)
  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
      lookup.current?.abort()
    }
  }, [])
  useEffect(() => {
    const check = () =>
      busy || importing
        ? (notify('请等待当前保存或图片导入完成。'), false)
        : !dirty ||
          confirm('还有未保存的修改。离开编辑？草稿会保留在本次浏览会话中。')
    guard.current = check
    const unload = (e: BeforeUnloadEvent) => {
      if (dirty || busy || importing) {
        e.preventDefault()
        e.returnValue = ''
      }
    }
    window.addEventListener('beforeunload', unload)
    return () => {
      guard.current = null
      window.removeEventListener('beforeunload', unload)
    }
  }, [dirty, busy, importing, guard, notify])
  useEffect(() => {
    if (!dirty) return
    try {
      sessionStorage.setItem(key, JSON.stringify(draft))
    } catch {
      if (!warned.current) {
        warned.current = true
        notify('草稿自动恢复暂不可用，请在离开前保存。')
      }
    }
  }, [draft, dirty, key, notify])
  const edit = (change: Partial<Recipe>) => {
    if (busy) return
    if (change.title != null) {
      lookup.current?.abort()
      setLooking(false)
    }
    setDraft((d) => ({ ...d, ...change }))
    setDirty(true)
    setErrors([])
  }
  if (id !== 'new' && !existing)
    return (
      <Empty title="没有找到这道个人菜谱。">
        <Flip onClick={() => go('/mine')}>回到我的菜谱 ↗</Flip>
      </Empty>
    )
  async function prefill() {
    if (!draft.title.trim()) {
      setNotice('先写上菜名，再来找资料。')
      return
    }
    const controller = new AbortController()
    lookup.current?.abort()
    lookup.current = controller
    setLooking(true)
    setNotice('')
    try {
      const filled = await lookupRecipe(
        draft.title.trim(),
        catalog,
        controller.signal,
      )
      if (controller.signal.aborted) return
      setDraft((d) => fillBlanks(d, filled))
      setDirty(true)
      setNotice(
        `已按「${filled.title}」补全空白资料（${filled.collection || filled.source.author}），请核对后保存。`,
      )
    } catch (e) {
      if (!controller.signal.aborted)
        setNotice(e instanceof Error ? e.message : '补全失败，可以手动填写。')
    } finally {
      if (!controller.signal.aborted) setLooking(false)
    }
  }
  async function save(e: FormEvent) {
    e.preventDefault()
    if (busy || looking || importing || !ready) return
    const problems = []
    if (!draft.title.trim()) problems.push('菜名不能为空。')
    if (!draft.categories.length) problems.push('至少选择一个分类。')
    if (!draft.ingredients.some((i) => i.name.trim()))
      problems.push('至少填写一项材料。')
    if (!draft.steps.some((s) => s.text.trim()))
      problems.push('至少填写一个步骤的正文。')
    if (
      draft.steps.some(
        (s) => (s.title.trim() || s.cue?.trim()) && !s.text.trim(),
      )
    )
      problems.push('已填写标题或提示的步骤需要正文。')
    if (problems.length) {
      setErrors(problems)
      return
    }
    setBusy(true)
    const kept = draft.ingredients.filter((i) => i.name.trim())
    const recipe: Recipe = {
      ...draft,
      title: draft.title.trim(),
      version: (existing?.version ?? 0) + 1,
      featured: false,
      servings: draft.servings.trim() || '无',
      ingredients: kept.map((i) => ({
        ...i,
        name: i.name.trim(),
        amount: i.amount.trim() || '无',
      })),
      steps: draft.steps
        .filter((s) => s.text.trim())
        .map((s, i) => ({
          ...s,
          order: i + 1,
          title: s.title.trim() || `第 ${i + 1} 步`,
          text: s.text.trim(),
          ingredientRefs: s.ingredientRefs?.filter((ref) =>
            kept.some((i) => i.id === ref),
          ),
        })),
      preparation: draft.preparation.filter(visible),
      notes: draft.notes.filter(visible),
    }
    try {
      await commit((d) => ({
        ...d,
        recipes: d.recipes.some((r) => r.id === recipe.id)
          ? d.recipes.map((r) => (r.id === recipe.id ? recipe : r))
          : [...d.recipes, recipe],
      }))
      try {
        sessionStorage.removeItem(key)
      } catch {
        /* Saved data is authoritative. */
      }
      guard.current = null
      setDirty(false)
      setBusy(false)
      go(`/recipe/${encodeURIComponent(recipe.id)}`)
      notify('这道菜谱，记下来了。')
    } catch {
      setBusy(false)
    }
  }
  return (
    <>
      <div className="k-breadcrumb">
        <Flip onClick={() => go('/mine')}>← 我的菜谱</Flip>
        <span className="label">WRITE IT. COOK IT. KEEP IT.</span>
      </div>
      <Heading
        index="03"
        en="YOUR RECIPE NOTEBOOK"
        title={existing ? '再添一点，自己的味道。' : '这一道，是你的拿手菜。'}
      />
      <form className="k-editor" onSubmit={save}>
        <fieldset disabled={busy}>
          <legend className="sr-only">编辑菜谱</legend>
          <section className="k-editor-section">
            <div className="k-section-title">
              <span className="label">01 / THE DISH</span>
              <h2>先认识这道菜。</h2>
              <p>
                资料补全只填写空白处。
                <br />
                你写下的，会好好保留。
              </p>
            </div>
            <div className="k-form-fields">
              <label>
                菜名 <span aria-hidden="true">*</span>
                <div className="k-input-action">
                  <input
                    required
                    maxLength={120}
                    value={draft.title}
                    onChange={(e) => edit({ title: e.target.value })}
                    placeholder="例如：番茄炒蛋"
                  />
                  <Flip
                    disabled={looking || importing}
                    onClick={() => void prefill()}
                  >
                    {looking ? '正在查找…' : '帮我补全 ↗'}
                  </Flip>
                </div>
              </label>
              {notice && (
                <p role="status" className="k-notice">
                  {notice}
                </p>
              )}
              <label>
                一句话简介
                <textarea
                  rows={2}
                  value={draft.description}
                  onChange={(e) => edit({ description: e.target.value })}
                />
              </label>
              <div className="k-form-row">
                <label>
                  地域
                  <select
                    value={draft.region}
                    onChange={(e) => edit({ region: e.target.value })}
                  >
                    {REGIONS.map((r) => (
                      <option key={r}>{r}</option>
                    ))}
                  </select>
                </label>
                <label>
                  参考用时 · 分钟
                  <input
                    type="number"
                    min={1}
                    max={1440}
                    step={1}
                    placeholder="无"
                    value={draft.minutes ?? ''}
                    onChange={(e) =>
                      edit({
                        minutes: e.target.value ? Number(e.target.value) : null,
                      })
                    }
                  />
                </label>
                <label>
                  难度
                  <select
                    value={draft.difficulty ?? ''}
                    onChange={(e) =>
                      edit({
                        difficulty: e.target.value
                          ? Number(e.target.value)
                          : null,
                      })
                    }
                  >
                    <option value="">无</option>
                    {[1, 2, 3, 4, 5].map((n) => (
                      <option key={n}>{n}</option>
                    ))}
                  </select>
                </label>
                <label>
                  原始份量
                  <input
                    placeholder="例如：2 人份"
                    value={draft.servings}
                    onChange={(e) => edit({ servings: e.target.value })}
                  />
                </label>
              </div>
              <fieldset className="k-tag-field">
                <legend>菜式分类 · 至少一项</legend>
                <div className="k-tags">
                  {CATEGORIES.map((c) => (
                    <button
                      type="button"
                      key={c}
                      aria-pressed={draft.categories.includes(c)}
                      className={draft.categories.includes(c) ? 'active' : ''}
                      onClick={() =>
                        edit({
                          categories: draft.categories.includes(c)
                            ? draft.categories.filter((x) => x !== c)
                            : [...draft.categories, c],
                        })
                      }
                    >
                      {c}
                    </button>
                  ))}
                </div>
              </fieldset>
              <div className="k-cover-editor">
                {draft.cover && <Photo path={draft.cover} alt="菜谱封面预览" />}
                <label className="k-upload">
                  {importing ? '正在处理图片…' : '从相册选择封面 ↗'}
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    disabled={importing}
                    onChange={async (e) => {
                      const file = e.target.files?.[0]
                      e.target.value = ''
                      if (!file) return
                      setImporting(true)
                      try {
                        const cover = await imageData(file)
                        if (mounted.current) edit({ cover })
                      } catch (err) {
                        notify(
                          err instanceof Error
                            ? err.message
                            : '图片读取失败，请换一张。',
                        )
                      } finally {
                        if (mounted.current) setImporting(false)
                      }
                    }}
                  />
                </label>
                {draft.cover && (
                  <Flip
                    disabled={importing}
                    onClick={() => edit({ cover: null })}
                  >
                    移除封面
                  </Flip>
                )}
              </div>
            </div>
          </section>
          <section className="k-editor-section">
            <div className="k-section-title">
              <span className="label">02 / INGREDIENTS</span>
              <h2>准备些什么？</h2>
              <p>
                用量保留你的写法。
                <br />
                不确定的，可以留空。
              </p>
            </div>
            <div className="k-form-fields">
              {draft.ingredients.map((i, n) => (
                <div className="k-ingredient-row" key={i.id}>
                  <label>
                    <span className="sr-only">材料 {n + 1}</span>
                    <input
                      placeholder="材料名称"
                      value={i.name}
                      onChange={(e) =>
                        edit({
                          ingredients: draft.ingredients.map((item, j) =>
                            j === n ? { ...item, name: e.target.value } : item,
                          ),
                        })
                      }
                    />
                  </label>
                  <label>
                    <span className="sr-only">材料 {n + 1} 用量</span>
                    <input
                      placeholder="用量"
                      value={visible(i.amount) ? i.amount : ''}
                      onChange={(e) =>
                        edit({
                          ingredients: draft.ingredients.map((item, j) =>
                            j === n
                              ? { ...item, amount: e.target.value }
                              : item,
                          ),
                        })
                      }
                    />
                  </label>
                  <button
                    type="button"
                    aria-label={`移除材料 ${n + 1}`}
                    className="k-icon"
                    onClick={() =>
                      edit({
                        ingredients:
                          draft.ingredients.length > 1
                            ? draft.ingredients.filter((_, j) => j !== n)
                            : [ingredient()],
                      })
                    }
                  >
                    ×
                  </button>
                </div>
              ))}
              <Flip
                onClick={() =>
                  edit({ ingredients: [...draft.ingredients, ingredient()] })
                }
              >
                ＋ 添加材料
              </Flip>
              <label>
                开火前的准备 · 每行一项
                <textarea
                  rows={3}
                  value={draft.preparation.join('\n')}
                  onChange={(e) =>
                    edit({ preparation: e.target.value.split('\n') })
                  }
                />
              </label>
            </div>
          </section>
          <section className="k-editor-section">
            <div className="k-section-title">
              <span className="label">03 / THE METHOD</span>
              <h2>把做法，写清楚。</h2>
              <p>
                一步一个动作，
                <br />
                再加一点观察心得。
              </p>
            </div>
            <div className="k-form-fields">
              {draft.steps.map((s, n) => (
                <div className="k-step-editor" key={s.id}>
                  <header>
                    <span className="label">
                      STEP {String(n + 1).padStart(2, '0')}
                    </span>
                    <div>
                      <button
                        type="button"
                        className="k-icon"
                        disabled={n === 0}
                        aria-label={`上移步骤 ${n + 1}`}
                        onClick={() => {
                          const next = [...draft.steps]
                          ;[next[n - 1], next[n]] = [next[n]!, next[n - 1]!]
                          edit({ steps: next })
                        }}
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        className="k-icon"
                        disabled={n === draft.steps.length - 1}
                        aria-label={`下移步骤 ${n + 1}`}
                        onClick={() => {
                          const next = [...draft.steps]
                          ;[next[n], next[n + 1]] = [next[n + 1]!, next[n]!]
                          edit({ steps: next })
                        }}
                      >
                        ↓
                      </button>
                      <button
                        type="button"
                        className="k-icon"
                        aria-label={`移除步骤 ${n + 1}`}
                        onClick={() =>
                          edit({
                            steps:
                              draft.steps.length > 1
                                ? draft.steps.filter((_, j) => j !== n)
                                : [step()],
                          })
                        }
                      >
                        ×
                      </button>
                    </div>
                  </header>
                  <label>
                    步骤标题
                    <input
                      placeholder={`第 ${n + 1} 步`}
                      value={s.title}
                      onChange={(e) =>
                        edit({
                          steps: draft.steps.map((item, j) =>
                            j === n ? { ...item, title: e.target.value } : item,
                          ),
                        })
                      }
                    />
                  </label>
                  <label>
                    操作正文
                    <textarea
                      rows={4}
                      value={s.text}
                      onChange={(e) =>
                        edit({
                          steps: draft.steps.map((item, j) =>
                            j === n ? { ...item, text: e.target.value } : item,
                          ),
                        })
                      }
                    />
                  </label>
                  <label>
                    观察提示
                    <textarea
                      rows={2}
                      value={visible(s.cue) ? (s.cue ?? '') : ''}
                      onChange={(e) =>
                        edit({
                          steps: draft.steps.map((item, j) =>
                            j === n ? { ...item, cue: e.target.value } : item,
                          ),
                        })
                      }
                    />
                  </label>
                </div>
              ))}
              <Flip onClick={() => edit({ steps: [...draft.steps, step()] })}>
                ＋ 添加步骤
              </Flip>
              <label>
                注意事项 · 每行一项
                <textarea
                  rows={4}
                  value={draft.notes.join('\n')}
                  onChange={(e) => edit({ notes: e.target.value.split('\n') })}
                />
              </label>
            </div>
          </section>
        </fieldset>
        {errors.length > 0 && (
          <div className="k-form-errors" role="alert">
            {errors.map((e) => (
              <p key={e}>{e}</p>
            ))}
          </div>
        )}
        <div className="k-editor-footer">
          <p className="k-fine">
            菜谱保存在当前浏览器。
            {dirty ? '当前修改尚未保存。' : '写完记得保存。'}
          </p>
          <Flip disabled={busy || importing} onClick={() => go('/mine')}>
            取消编辑
          </Flip>
          <button
            className="btn"
            type="submit"
            disabled={busy || importing || looking || !ready}
          >
            {busy ? '正在保存…' : '保存这道菜 ↗'}
          </button>
        </div>
      </form>
    </>
  )
}
