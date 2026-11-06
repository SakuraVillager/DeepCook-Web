import { useEffect, useRef, useState } from 'react'
import { useKitchen } from './context'
import { isMine, lines, recordVisit, safeUrl, visible } from './domain'
import type { Recipe } from './types'
import { Empty, Flip, Modal, Photo, Star } from './ui'

export function RecipeView({ recipe }: { recipe?: Recipe }) {
  const { go, user, commit, favorite, ready, notify } = useKitchen()
  const recorded = useRef('')
  const [activeSection, setActiveSection] = useState('ingredients')
  useEffect(() => {
    if (!recipe) return
    let frame = 0
    const update = () => {
      frame = 0
      const sections = Array.from(
        document.querySelectorAll<HTMLElement>('.k-detail-section'),
      )
      const current = sections
        .reverse()
        .find(
          (section) =>
            section.getBoundingClientRect().top <=
            Math.min(innerHeight * 0.35, 240),
        )
      setActiveSection(current?.id ?? 'ingredients')
    }
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update)
    }
    update()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
      cancelAnimationFrame(frame)
    }
  }, [recipe?.id])
  useEffect(() => {
    if (!recipe || !ready || recorded.current === recipe.id) return
    const timer = setTimeout(() => {
      recorded.current = recipe.id
      void commit((d) => recordVisit(d, recipe.id)).catch(() => {})
    }, 320)
    return () => clearTimeout(timer)
  }, [recipe, ready, commit])
  const saved = user.favorites.some((f) => f.recipeId === recipe?.id)
  const [deleting, setDeleting] = useState(false),
    [busy, setBusy] = useState(false)
  if (!recipe)
    return (
      <Empty
        title="没有找到这道菜。"
        text="它可能已被删除，回到菜谱库重新找找。"
      >
        <Flip className="btn" onClick={() => go('/discover')}>
          回到找菜 ↗
        </Flip>
      </Empty>
    )
  const sections = [
    ['ingredients', '材料'],
    ...(lines(recipe.preparation).length ? [['preparation', '准备']] : []),
    ['steps', '步骤'],
    ...(lines(recipe.notes).length ? [['notes', '注意事项']] : []),
    ['source', '来源'],
  ]
  const sourceUrl = safeUrl(recipe.source.url)
  return (
    <>
      <div className="k-breadcrumb">
        <Flip onClick={() => go('/discover')}>← 回到菜谱</Flip>
        <span className="label">
          {recipe.collection || 'RECIPE'} / {recipe.region}
        </span>
      </div>
      <div className="k-detail-hero">
        <figure className="k-recipe-visual">
          <Photo eager path={recipe.cover} alt={recipe.title} />
          <figcaption>
            <span className="k-recipe-visual__caption">
              A little care. A better meal.
            </span>
            <span className="label">DEEPCOOK / RECIPE BOOK</span>
          </figcaption>
        </figure>
        <div className="k-detail-intro">
          <div className="k-recipe-eyebrow">
            <span className="label">THE RECIPE / 好好做一道菜</span>
            <span className="k-recipe-region">
              {visible(recipe.region) ? recipe.region : '厨房手记'}
            </span>
          </div>
          <h1>{recipe.title}</h1>
          <div className="k-recipe-tags">
            {recipe.categories.map((category) => (
              <span key={category}>{category}</span>
            ))}
          </div>
          <p>{recipe.description}</p>
          <div className="k-metadata">
            <div>
              <span>参考用时</span>
              <b>
                {recipe.minutes ?? '无'}
                <small>{recipe.minutes == null ? '' : ' MIN'}</small>
              </b>
            </div>
            <div>
              <span>烹饪难度</span>
              <b>
                {recipe.difficulty ?? '无'}
                <small>{recipe.difficulty == null ? '' : ' / 5'}</small>
              </b>
            </div>
            <div>
              <span>原始份量</span>
              <b className="k-servings">{recipe.servings}</b>
            </div>
          </div>
          <div className="k-detail-actions">
            <Flip
              className="btn"
              onClick={() =>
                go(
                  `/read/${encodeURIComponent(recipe.id)}/${encodeURIComponent(recipe.steps[0]!.id)}`,
                )
              }
            >
              进入分步阅读 ↗
            </Flip>
            <button
              className={`k-save ${saved ? 'is-saved' : ''}`}
              disabled={!ready}
              onClick={() => favorite(recipe)}
              aria-pressed={saved}
            >
              <Star active={saved} />
              {saved ? '已收藏' : '收藏这道菜'}
            </button>
          </div>
          <div className="k-recipe-summary">
            <span>
              <b>{String(recipe.ingredients.length).padStart(2, '0')}</b> 样材料
            </span>
            <span>
              <b>{String(recipe.steps.length).padStart(2, '0')}</b> 个步骤
            </span>
            <span className="k-recipe-summary__note">备好食材，慢慢来。</span>
          </div>
        </div>
      </div>
      <nav className="k-detail-nav" aria-label="菜谱分段">
        <span className="k-detail-nav__title">{recipe.title}</span>
        <div className="k-detail-nav__links">
          {sections.map(([id, label]) => (
            <a
              key={id}
              href={`#${id}`}
              aria-current={activeSection === id ? 'location' : undefined}
              onClick={(e) => {
                e.preventDefault()
                document.getElementById(id!)?.scrollIntoView({
                  behavior: matchMedia('(prefers-reduced-motion: reduce)')
                    .matches
                    ? 'instant'
                    : 'smooth',
                  block: 'start',
                })
              }}
            >
              {label}
            </a>
          ))}
        </div>
        <Flip
          className="k-detail-nav__reader"
          onClick={() =>
            go(
              `/read/${encodeURIComponent(recipe.id)}/${encodeURIComponent(recipe.steps[0]!.id)}`,
            )
          }
        >
          分步阅读 ↗
        </Flip>
      </nav>
      <div
        className={`k-detail-content k-reading-${user.preferences.readingSize}`}
      >
        <section id="ingredients" className="k-detail-section">
          <div className="k-section-title">
            <span className="label">01 / INGREDIENTS</span>
            <h2>先备好，这些。</h2>
            <p>材料用量按原文保留 · {recipe.servings}</p>
          </div>
          <div className="k-ingredient-sheet">
            <div className="k-ingredient-sheet__head">
              <span className="label">WHAT YOU’LL NEED</span>
              <span>原始用量</span>
            </div>
            <ul className="k-ingredients">
              {recipe.ingredients.map((i) => (
                <li key={i.id}>
                  <span>{i.name}</span>
                  <span>{i.amount || '无'}</span>
                </li>
              ))}
            </ul>
            <p className="k-ingredient-sheet__note">
              用量与份量保留原文，未提供的参数显示「无」。
            </p>
          </div>
        </section>
        {lines(recipe.preparation).length > 0 && (
          <section id="preparation" className="k-detail-section">
            <div className="k-section-title">
              <span className="label">PREPARATION</span>
              <h2>开火之前。</h2>
            </div>
            <ul className="k-prose-list">
              {lines(recipe.preparation).map((line, i) => (
                <li key={i}>{line}</li>
              ))}
            </ul>
          </section>
        )}
        <section id="steps" className="k-detail-section">
          <div className="k-section-title">
            <span className="label">02 / THE METHOD</span>
            <h2>
              一步一步，
              <br />
              不慌不忙。
            </h2>
            <p>{recipe.steps.length} 个步骤，慢慢来。</p>
          </div>
          <ol className="k-method">
            {recipe.steps.map((s, i) => (
              <li key={s.id} id={`step-${s.id}`}>
                <span className="k-method__number">
                  {String(i + 1).padStart(2, '0')}
                </span>
                <div>
                  <div className="k-method__heading">
                    <h3>{s.title}</h3>
                    <Flip
                      onClick={() =>
                        go(
                          `/read/${encodeURIComponent(recipe.id)}/${encodeURIComponent(s.id)}`,
                        )
                      }
                    >
                      放大阅读 ↗
                    </Flip>
                  </div>
                  <p>{s.text}</p>
                  {user.preferences.showStepImages && s.image && (
                    <Photo path={s.image} alt={`${recipe.title}，${s.title}`} />
                  )}
                  {visible(s.cue) && (
                    <aside className="k-observation">
                      <b>观察提示</b>
                      <p>{s.cue}</p>
                    </aside>
                  )}
                </div>
              </li>
            ))}
          </ol>
        </section>
        {lines(recipe.notes).length > 0 && (
          <section id="notes" className="k-detail-section">
            <div className="k-section-title">
              <span className="label">03 / LITTLE NOTES</span>
              <h2>再多懂一点。</h2>
            </div>
            <ul className="k-prose-list">
              {lines(recipe.notes).map((n, i) => (
                <li key={i}>{n}</li>
              ))}
            </ul>
          </section>
        )}
        <section id="source" className="k-detail-section k-source">
          <div className="k-section-title">
            <span className="label">SOURCE & CREDITS</span>
            <h2>每一道，都有来处。</h2>
          </div>
          <div className="k-recipe-source-card">
            <span className="label">FROM THE ORIGINAL / 保留每一份来处</span>
            <h3>{recipe.source.author}</h3>
            <p>{recipe.source.license}</p>
            {sourceUrl && (
              <a
                className="k-text-link"
                href={sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                查看原始来源 ↗
              </a>
            )}
            {isMine(recipe) && (
              <div className="k-detail-actions">
                <Flip
                  onClick={() => go(`/edit/${encodeURIComponent(recipe.id)}`)}
                >
                  编辑这道菜 ↗
                </Flip>
                <Flip className="k-danger" onClick={() => setDeleting(true)}>
                  删除菜谱
                </Flip>
              </div>
            )}
          </div>
        </section>
      </div>
      {deleting && (
        <Modal
          title="删除这道菜谱？"
          onClose={() => {
            if (!busy) setDeleting(false)
          }}
        >
          <p>这道菜谱、封面及对应的收藏和浏览记录会一并移除。</p>
          <div className="k-modal-actions">
            <Flip onClick={() => setDeleting(false)} disabled={busy}>
              先留着
            </Flip>
            <Flip
              className="btn"
              disabled={busy}
              onClick={async () => {
                setBusy(true)
                try {
                  await commit((d) => ({
                    ...d,
                    recipes: d.recipes.filter((r) => r.id !== recipe.id),
                    favorites: d.favorites.filter(
                      (r) => r.recipeId !== recipe.id,
                    ),
                    recent: d.recent.filter((r) => r.recipeId !== recipe.id),
                  }))
                  go('/mine')
                  notify('已删除这道菜谱及对应记录。')
                } catch {
                  setBusy(false)
                }
              }}
            >
              {busy ? '正在删除…' : '确认删除'}
            </Flip>
          </div>
        </Modal>
      )}
    </>
  )
}

export function Reader({
  recipe,
  stepId,
}: {
  recipe?: Recipe
  stepId?: string
}) {
  const { user, go, notify } = useKitchen(),
    [directory, setDirectory] = useState(false)
  const index = Math.max(
      0,
      recipe?.steps.findIndex((s) => s.id === stepId) ?? 0,
    ),
    step = recipe?.steps[index]
  const content = useRef<HTMLDivElement>(null)
  useEffect(() => {
    content.current?.scrollTo(0, 0)
  }, [stepId])
  useEffect(() => {
    if (!user.preferences.keepScreenOn) return
    let lock: WakeLockSentinel | undefined,
      closed = false
    const acquire = async () => {
      if (document.visibilityState !== 'visible') return
      try {
        const next = await navigator.wakeLock.request('screen')
        if (closed) await next.release()
        else lock = next
      } catch {
        if (!closed) notify('当前浏览器无法保持屏幕常亮，阅读仍可继续。')
      }
    }
    if ('wakeLock' in navigator) void acquire()
    else notify('当前浏览器不支持保持屏幕常亮。')
    const onVisibility = () => {
      if (!lock || lock.released) void acquire()
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      closed = true
      void lock?.release()
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [user.preferences.keepScreenOn, notify])
  if (!recipe || !step)
    return (
      <Empty title="没有找到阅读内容。">
        <Flip onClick={() => go('/discover')}>回到找菜 ↗</Flip>
      </Empty>
    )
  const move = (n: number) =>
    go(
      `/read/${encodeURIComponent(recipe.id)}/${encodeURIComponent(recipe.steps[n]!.id)}`,
    )
  return (
    <div className={`k-reader k-reading-${user.preferences.readingSize}`}>
      <header className="k-reader__header">
        <Flip
          onClick={() => {
            go(`/recipe/${encodeURIComponent(recipe.id)}`)
            setTimeout(
              () =>
                document
                  .getElementById(`step-${step.id}`)
                  ?.scrollIntoView({ block: 'center' }),
              80,
            )
          }}
        >
          ← 返回菜谱
        </Flip>
        <span>{recipe.title}</span>
        <Flip onClick={() => setDirectory(true)}>步骤目录 ≡</Flip>
      </header>
      <div
        className="k-reader__progress"
        role="progressbar"
        aria-label="阅读进度"
        aria-valuemin={1}
        aria-valuemax={recipe.steps.length}
        aria-valuenow={index + 1}
      >
        <i style={{ width: `${((index + 1) / recipe.steps.length) * 100}%` }} />
      </div>
      <div className="k-reader__content" ref={content} key={step.id}>
        <div className="k-reader__number" aria-hidden="true">
          {String(index + 1).padStart(2, '0')}
        </div>
        <article>
          <span className="label">
            STEP {String(index + 1).padStart(2, '0')} /{' '}
            {String(recipe.steps.length).padStart(2, '0')}
          </span>
          <h1>{step.title}</h1>
          <p>{step.text}</p>
          {user.preferences.showStepImages && step.image && (
            <Photo
              path={step.image}
              alt={`${recipe.title}，${step.title}`}
              eager
            />
          )}
          {visible(step.cue) && (
            <aside className="k-observation">
              <b>观察提示</b>
              <p>{step.cue}</p>
            </aside>
          )}
          {Boolean(step.ingredientRefs?.length) && (
            <div className="k-reader__ingredients">
              <span className="label">本步骤材料</span>
              {recipe.ingredients
                .filter((i) => step.ingredientRefs?.includes(i.id))
                .map((i) => (
                  <p key={i.id}>
                    {i.name} · {i.amount}
                  </p>
                ))}
            </div>
          )}
        </article>
      </div>
      <footer className="k-reader__footer">
        <Flip disabled={index === 0} onClick={() => move(index - 1)}>
          ← 上一步
        </Flip>
        <span className="label">翻步记录阅读位置</span>
        <Flip
          className="btn"
          onClick={() =>
            index === recipe.steps.length - 1
              ? go(`/recipe/${encodeURIComponent(recipe.id)}`)
              : move(index + 1)
          }
        >
          {index === recipe.steps.length - 1 ? '返回菜谱 ↗' : '下一步 →'}
        </Flip>
      </footer>
      {directory && (
        <Modal title="步骤目录" onClose={() => setDirectory(false)}>
          <ol className="k-directory">
            {recipe.steps.map((s, n) => (
              <li key={s.id}>
                <button
                  aria-current={n === index ? 'step' : undefined}
                  onClick={() => {
                    move(n)
                    setDirectory(false)
                  }}
                >
                  <span>{String(n + 1).padStart(2, '0')}</span>
                  {s.title}
                </button>
              </li>
            ))}
          </ol>
        </Modal>
      )}
    </div>
  )
}
