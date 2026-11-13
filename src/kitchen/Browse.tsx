import { useEffect, useMemo, useRef, useState } from 'react'
import { useKitchen } from './context'
import { filterRecipes } from './domain'
import { CATEGORIES, REGIONS, type Filter, type Recipe } from './types'
import { Empty, Flip, Heading, Photo, Star } from './ui'
import { recommendRecipes } from './food-recommendations'

export function RecipeCard({
  recipe,
  number,
  onRemove,
}: {
  recipe: Recipe
  number: number
  onRemove?: () => void
}) {
  const { go, user, favorite, ready } = useKitchen(),
    saved = user.favorites.some((f) => f.recipeId === recipe.id)
  return (
    <article className="k-card">
      <button
        className="k-card__cover"
        onClick={() => go(`/recipe/${encodeURIComponent(recipe.id)}`)}
        aria-label={`查看${recipe.title}`}
      >
        <Photo path={recipe.cover} alt={recipe.title} />
        <span className="k-card__cover-meta">
          {recipe.minutes == null ? '用时无' : `${recipe.minutes} MIN`}
          <span>
            {recipe.difficulty == null
              ? '难度无'
              : `难度 ${recipe.difficulty} / 5`}
          </span>
        </span>
      </button>
      <div className="k-card__body">
        <span className="label k-card__index">
          {String(number).padStart(3, '0')} / {recipe.region}
        </span>
        <h3>
          <button
            onClick={() => go(`/recipe/${encodeURIComponent(recipe.id)}`)}
          >
            {recipe.title}
          </button>
        </h3>
        <p>
          {recipe.categories.slice(0, 2).join(' · ')}
          <span>{recipe.servings}</span>
        </p>
        <button
          className={`k-icon k-card__star ${saved ? 'is-saved' : ''}`}
          disabled={!ready}
          aria-label={`${saved ? '取消收藏' : '收藏'}${recipe.title}`}
          aria-pressed={saved}
          onClick={() => favorite(recipe)}
        >
          <Star active={saved} />
        </button>
      </div>
      {onRemove && (
        <button className="k-remove-history" onClick={onRemove}>
          移除浏览记录
        </button>
      )}
    </article>
  )
}
export function Browse({
  mode,
}: {
  mode: 'discover' | 'favorites' | 'recent' | 'mine'
}) {
  const { catalog, user, go, commit } = useKitchen()
  const filterKey = `deepcook-filter-${mode}`
  const [filter, setFilter] = useState<Filter>(() => {
    try {
      const saved = JSON.parse(sessionStorage.getItem(filterKey) ?? 'null')
      if (
        saved &&
        ['query', 'category', 'time', 'difficulty'].every(
          (k) => typeof saved[k] === 'string',
        )
      )
        return saved
    } catch {
      /* Optional session state. */
    }
    return { query: '', category: '全部', time: '', difficulty: '' }
  })
  const [query, setQuery] = useState(filter.query),
    [limit, setLimit] = useState(() => {
      try {
        return Math.max(
          24,
          Number(sessionStorage.getItem(`${filterKey}-limit`)) || 24,
        )
      } catch {
        return 24
      }
    })
  const previousFilter = useRef(JSON.stringify(filter))
  useEffect(() => {
    const timer = setTimeout(() => setFilter((f) => ({ ...f, query })), 250)
    return () => clearTimeout(timer)
  }, [query])
  useEffect(() => {
    const serialized = JSON.stringify(filter)
    try {
      sessionStorage.setItem(filterKey, serialized)
    } catch {
      /* Optional session state. */
    }
    if (previousFilter.current !== serialized) {
      previousFilter.current = serialized
      setLimit(24)
    }
  }, [filter, filterKey])
  useEffect(() => {
    try {
      sessionStorage.setItem(`${filterKey}-limit`, String(limit))
    } catch {
      /* Optional session state. */
    }
  }, [limit, filterKey])
  const recipes = useMemo(() => {
    const all = [...catalog, ...user.recipes]
    if (mode === 'mine') return [...user.recipes].reverse()
    if (mode === 'favorites' || mode === 'recent')
      return user[mode].flatMap((f) => {
        const r = all.find((r) => r.id === f.recipeId)
        return r ? [r] : []
      })
    return all
  }, [catalog, user, mode])
  const filtered = useMemo(
    () => filterRecipes(recipes, filter),
    [recipes, filter],
  )
  const searching = Boolean(
    filter.query ||
    filter.category !== '全部' ||
    filter.time ||
    filter.difficulty,
  )
  const featured =
    mode === 'discover' && !searching
      ? recommendRecipes([...catalog, ...user.recipes], user.foodSetup.profile)
      : []
  const settings = {
    discover: ['01', 'FIND YOUR DISH', '今天，想做点什么？'],
    favorites: ['02', 'SAVED FOR LATER', '收藏好菜，慢慢下厨。'],
    recent: ['04', 'RECENTLY OPENED', '再翻一页，熟悉的味道。'],
    mine: ['03', 'YOUR OWN RECIPES', '把拿手菜，写下来。'],
  }[mode]
  return (
    <>
      <Heading index={settings[0]!} en={settings[1]!} title={settings[2]!}>
        {mode === 'mine' ? (
          <Flip className="btn" onClick={() => go('/edit/new')}>
            新建菜谱 ↗
          </Flip>
        ) : (
          <p className="k-heading__aside">
            {mode === 'discover' ? (
              <>
                从看懂火候，到做完一桌菜。
                <br />
                你的厨房，从这里开始。
              </>
            ) : (
              `共 ${recipes.length} 道，留给下一次好好吃饭。`
            )}
          </p>
        )}
      </Heading>
      <section className="k-search" aria-label="查找菜谱">
        <label className="k-search__input">
          <span aria-hidden="true">⌕</span>
          <span className="sr-only">搜索菜名、材料或别名</span>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="菜名、材料、别名……"
          />
          {query && (
            <button
              className="k-icon"
              onClick={() => setQuery('')}
              aria-label="清空搜索"
            >
              ×
            </button>
          )}
        </label>
        <div className="k-filters">
          <label>
            分类
            <select
              value={filter.category}
              onChange={(e) =>
                setFilter((f) => ({ ...f, category: e.target.value }))
              }
            >
              {['全部', ...REGIONS, ...CATEGORIES].map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </label>
          <label>
            用时
            <select
              value={filter.time}
              onChange={(e) =>
                setFilter((f) => ({ ...f, time: e.target.value }))
              }
            >
              <option value="">不限用时</option>
              <option value="15">15 分钟以内</option>
              <option value="30">30 分钟以内</option>
              <option value="60">60 分钟以内</option>
              <option value="long">60 分钟以上</option>
            </select>
          </label>
          <label>
            难度
            <select
              value={filter.difficulty}
              onChange={(e) =>
                setFilter((f) => ({ ...f, difficulty: e.target.value }))
              }
            >
              <option value="">不限难度</option>
              {[1, 2, 3, 4, 5].map((n) => (
                <option key={n} value={n}>
                  {n} / 5
                </option>
              ))}
            </select>
          </label>
        </div>
      </section>
      {mode === 'discover' && (
        <div className="k-category-rail" aria-label="快捷分类">
          {[
            '全部',
            '家常菜',
            '快手菜',
            '肉类',
            '素食',
            '主食',
            '汤羹',
            '烘焙甜点',
            '国际菜',
          ].map((c) => (
            <button
              className={filter.category === c ? 'active' : ''}
              key={c}
              aria-pressed={filter.category === c}
              onClick={() => setFilter((f) => ({ ...f, category: c }))}
            >
              {c}
            </button>
          ))}
        </div>
      )}
      {featured.length > 0 && (
        <section className="k-featured">
          <div className="k-section-label">
            <span className="label">{user.foodSetup.profile.cuisines.length || user.foodSetup.profile.allergens?.length || user.foodSetup.profile.goals.length ? 'MADE FOR YOUR KITCHEN / 为你推荐' : 'TONIGHT’S TABLE / 今晚的灵感'}</span>
            <span className="label">SELECTED {String(featured.length).padStart(2, '0')}</span>
          </div>
          <div className="k-featured__track">
            {featured.map((r, i) => (
              <RecipeCard key={r.id} recipe={r} number={i + 1} />
            ))}
          </div>
        </section>
      )}
      <section>
        <div className="k-section-label">
          <h2>
            {searching
              ? '找到这些味道'
              : mode === 'discover'
                ? '翻开全部菜谱'
                : '厨房里的记录'}{' '}
            <span className="k-count">{filtered.length}</span>
          </h2>
          {searching ? (
            <Flip
              onClick={() => {
                setQuery('')
                setFilter({
                  query: '',
                  category: '全部',
                  time: '',
                  difficulty: '',
                })
              }}
            >
              清除搜索与筛选 ↗
            </Flip>
          ) : (
            <span className="label">COOK DEEPER. EAT BETTER.</span>
          )}
        </div>
        {filtered.length ? (
          <>
            <div className="k-grid">
              {filtered.slice(0, limit).map((r, i) => (
                <RecipeCard
                  key={r.id}
                  recipe={r}
                  number={i + 1}
                  onRemove={
                    mode === 'recent'
                      ? () => {
                          void commit((d) => ({
                            ...d,
                            recent: d.recent.filter((v) => v.recipeId !== r.id),
                          })).catch(() => {})
                        }
                      : undefined
                  }
                />
              ))}
            </div>
            {limit < filtered.length && (
              <div className="k-load-more">
                <p className="label">
                  {Math.min(limit, filtered.length)} / {filtered.length} RECIPES
                </p>
                <Flip
                  className="btn btn--ghost"
                  onClick={() => setLimit((l) => l + 24)}
                >
                  继续翻阅 ↓
                </Flip>
              </div>
            )}
          </>
        ) : (
          <Empty
            title={
              searching
                ? '这一味，还没找到。'
                : mode === 'favorites'
                  ? '把想做的菜，留在这里。'
                  : mode === 'mine'
                    ? '第一道拿手菜，等你来写。'
                    : '厨房还没有留下足迹。'
            }
            text={
              searching
                ? '多个关键词需要同时匹配，试着减少关键词或放宽筛选。'
                : mode === 'favorites'
                  ? '点击菜谱上的星标，就能留到下次下厨。'
                  : mode === 'mine'
                    ? '记录材料、步骤和一点自己的心得。'
                    : '打开一道菜谱，它就会出现在这里。'
            }
          >
            <Flip
              className="btn"
              onClick={() => go(mode === 'mine' ? '/edit/new' : '/discover')}
            >
              {mode === 'mine' ? '写一道菜 ↗' : '去找菜 ↗'}
            </Flip>
          </Empty>
        )}
      </section>
    </>
  )
}
