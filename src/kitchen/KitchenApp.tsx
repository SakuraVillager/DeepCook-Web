import { useCallback, useEffect, useRef, useState } from 'react'
import { Header } from '../components/Header'
import { Footer } from '../components/Footer'
import { Cursor } from '../components/Cursor'
import { useReducedMotion } from '../hooks/useReducedMotion'
import { Browse } from './Browse'
import { CatalogLoader } from './CatalogLoader'
import { Kitchen } from './context'
import { emptyUser, publicUrl, validRecipe } from './domain'
import { Editor } from './Editor'
import { Profile, Settings } from './Profile'
import { RecipeView } from './RecipeView'
import { Reader } from './Reader'
import { readUser, updateUser } from './storage'
import type { Recipe, UserData } from './types'
import { Empty, Flip } from './ui'

function currentRoute() {
  return window.location.hash.startsWith('#/')
    ? window.location.hash.slice(1)
    : '/discover'
}
function decode(value = '') {
  try {
    return decodeURIComponent(value)
  } catch {
    return ''
  }
}
const navItems = [
  { href: '/discover', zh: '找菜', en: 'FIND' },
  { href: '/favorites', zh: '收藏', en: 'SAVE' },
  { href: '/mine', zh: '我的菜谱', en: 'WRITE' },
  { href: '/profile', zh: '我的厨房', en: 'KITCHEN' },
]

export default function KitchenApp() {
  const [route, setRoute] = useState(currentRoute),
    [catalog, setCatalog] = useState<Recipe[]>([]),
    [catalogError, setCatalogError] = useState(''),
    [loading, setLoading] = useState(true)
  const [user, setUser] = useState<UserData>(emptyUser),
    [ready, setReady] = useState(false),
    [storageError, setStorageError] = useState('')
  const [message, setMessage] = useState<{
    text: string
    undo?: () => void
    key: number
  } | null>(null)
  const guard = useRef<(() => boolean) | null>(null),
    activeRoute = useRef(route),
    authorized = useRef(false),
    positions = useRef(new Map<string, number>()),
    main = useRef<HTMLElement>(null)
  const reduced = useReducedMotion()
  const [introDone, setIntroDone] = useState(false)
  const finishIntro = useCallback(() => setIntroDone(true), [])
  const pendingWrites = useRef(0)
  useEffect(() => {
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (pendingWrites.current > 0) {
        event.preventDefault()
        event.returnValue = ''
      }
    }
    window.addEventListener('beforeunload', beforeUnload)
    return () => window.removeEventListener('beforeunload', beforeUnload)
  }, [])
  const notify = useCallback(
    (text: string, undo?: () => void) =>
      setMessage({ text, undo, key: Date.now() }),
    [],
  )
  useEffect(() => {
    if (!message) return
    const t = setTimeout(() => setMessage(null), message.undo ? 10000 : 6000)
    return () => clearTimeout(t)
  }, [message])
  const loadCatalog = useCallback(async () => {
    setLoading(true)
    setIntroDone(false)
    setCatalogError('')
    try {
      const response = await fetch(publicUrl('catalog/recipes.json'))
      if (!response.ok) throw new Error()
      const data: unknown = await response.json()
      if (!Array.isArray(data) || !data.every(validRecipe)) throw new Error()
      setCatalog(data)
    } catch {
      setCatalogError('菜谱暂时无法读取，请检查网络后重试。')
    } finally {
      setLoading(false)
    }
  }, [])
  const loadUser = useCallback(async () => {
    try {
      setUser(await readUser())
      setReady(true)
      setStorageError('')
    } catch (e) {
      setReady(false)
      setStorageError(
        e instanceof Error ? e.message : '本地数据读取失败，原数据已保留。',
      )
    }
  }, [])
  useEffect(() => {
    void loadCatalog()
    void loadUser()
  }, [loadCatalog, loadUser])
  useEffect(() => {
    if (!('BroadcastChannel' in window)) return
    const channel = new BroadcastChannel('deepcook-updates')
    channel.onmessage = () => void loadUser()
    return () => channel.close()
  }, [loadUser])
  const commit = useCallback(
    async (transform: (data: UserData) => UserData) => {
      pendingWrites.current++
      try {
        const next = await updateUser(transform)
        setUser(next)
        setStorageError('')
      } catch (e) {
        notify(
          e instanceof Error ? e.message : '保存失败，原数据和当前输入仍保留。',
        )
        throw e
      } finally {
        pendingWrites.current--
      }
    },
    [notify],
  )
  const go = useCallback((next: string) => {
    if (next === activeRoute.current || guard.current?.() === false) return
    authorized.current = true
    window.location.hash = next
  }, [])
  useEffect(() => {
    const changed = () => {
      const next = currentRoute()
      if (!authorized.current && guard.current?.() === false) {
        history.replaceState(null, '', `#${activeRoute.current}`)
        return
      }
      authorized.current = false
      positions.current.set(activeRoute.current, window.scrollY)
      activeRoute.current = next
      setRoute(next)
      requestAnimationFrame(() => {
        window.scrollTo({
          top: positions.current.get(next) ?? 0,
          behavior: 'instant',
        })
        main.current?.focus({ preventScroll: true })
      })
    }
    window.addEventListener('hashchange', changed)
    return () => window.removeEventListener('hashchange', changed)
  }, [])
  useEffect(() => {
    const media = matchMedia('(prefers-color-scheme: dark)')
    const update = () => {
      document.documentElement.dataset.kitchenTheme =
        user.preferences.theme === 'system'
          ? media.matches
            ? 'dark'
            : 'light'
          : user.preferences.theme
    }
    update()
    media.addEventListener('change', update)
    return () => {
      media.removeEventListener('change', update)
      delete document.documentElement.dataset.kitchenTheme
    }
  }, [user.preferences.theme])
  const favorite = useCallback(
    (recipe: Recipe) => {
      let removed: UserData['favorites'][number] | undefined
      void commit((d) => {
        removed = d.favorites.find((f) => f.recipeId === recipe.id)
        return {
          ...d,
          favorites: removed
            ? d.favorites.filter((f) => f.recipeId !== recipe.id)
            : [{ recipeId: recipe.id, timestamp: Date.now() }, ...d.favorites],
        }
      })
        .then(() => {
          if (removed) {
            const saved = removed
            notify(
              '已取消收藏。',
              () =>
                void commit((d) => ({
                  ...d,
                  favorites: [
                    ...d.favorites.filter((f) => f.recipeId !== recipe.id),
                    saved,
                  ].sort((a, b) => b.timestamp - a.timestamp),
                })).catch(() => {}),
            )
          } else notify('已收藏，留给下一次下厨。')
        })
        .catch(() => {})
    },
    [commit, notify],
  )
  const [, page, rawId, rawStep] = route.split('/'),
    id = decode(rawId),
    step = decode(rawStep),
    recipe = [...catalog, ...user.recipes].find((r) => r.id === id)
  const reader = page === 'read',
    selectedNav =
      page === 'edit'
        ? '/mine'
        : ['recent', 'settings'].includes(page ?? '')
          ? '/profile'
          : `/${page}`
  useEffect(() => {
    const titles: Record<string, string> = {
      discover: '今天，想做点什么？',
      favorites: '收藏好菜',
      mine: '我的菜谱',
      profile: '我的厨房',
      settings: '偏好与设置',
      recent: '最近浏览',
      edit: '写一道菜',
    }
    document.title = `${recipe?.title ?? titles[page ?? ''] ?? '在线版'} — DeepCook`
  }, [page, recipe?.title])
  let content
  if (loading)
    content = <div className="k-loading-placeholder" aria-hidden="true" />
  else if (catalogError)
    content = (
      <Empty title="厨房还在准备中。" text={catalogError}>
        <Flip className="btn" onClick={() => void loadCatalog()}>
          重新读取 ↗
        </Flip>
      </Empty>
    )
  else if (['discover', 'favorites', 'recent', 'mine'].includes(page ?? ''))
    content = (
      <Browse
        key={page}
        mode={page as 'discover' | 'favorites' | 'recent' | 'mine'}
      />
    )
  else if (page === 'recipe') content = <RecipeView key={id} recipe={recipe} />
  else if (page === 'read') content = <Reader recipe={recipe} stepId={step} />
  else if (page === 'edit')
    content = ready ? (
      <Editor key={id} id={id} />
    ) : (
      <Empty
        title="先让厨房笔记准备好。"
        text={storageError || '正在打开本地存储…'}
      >
        <Flip onClick={() => void loadUser()}>重新读取 ↗</Flip>
      </Empty>
    )
  else if (page === 'profile') content = <Profile />
  else if (page === 'settings') content = <Settings />
  else
    content = (
      <Empty title="这一页，还没翻到。">
        <Flip className="btn" onClick={() => go('/discover')}>
          回到找菜 ↗
        </Flip>
      </Empty>
    )
  return (
    <Kitchen.Provider
      value={{
        catalog,
        user,
        ready,
        interactive: introDone,
        commit,
        go,
        notify,
        favorite,
        guard,
      }}
    >
      <>
        <div
          className={`kitchen ${reader ? 'kitchen--reader' : ''}`}
          inert={!introDone}
        >
          <a
            className="skip-link"
            href="#kitchen-main"
            onClick={(e) => {
              e.preventDefault()
              main.current?.focus()
            }}
          >
            跳到主要内容
          </a>
          <Cursor reduced={reduced} />
          {!reader && (
            <Header
              edition={{
                items: navItems,
                activeHref: selectedNav,
                onNavigate: go,
              }}
            />
          )}
          {storageError && (
            <div className="k-storage-alert" role="alert">
              <span>{storageError} 仍可浏览内置菜谱。</span>
              <Flip onClick={() => void loadUser()}>重试 ↗</Flip>
            </div>
          )}
          <main className="k-main" id="kitchen-main" tabIndex={-1} ref={main}>
            <div key={reader ? 'reader' : route} className="k-page">
              {content}
            </div>
          </main>
          {!reader && <Footer homeHref="../index.html" assetPrefix="../" />}
          {message && (
            <div key={message.key} className="k-toast" role="status">
              <span>{message.text}</span>
              {message.undo && (
                <button
                  onClick={() => {
                    message.undo?.()
                    setMessage(null)
                  }}
                >
                  撤销
                </button>
              )}
              <button aria-label="关闭提示" onClick={() => setMessage(null)}>
                ×
              </button>
            </div>
          )}
          <div className="grain" aria-hidden="true" />
        </div>
        {!introDone && (
          <CatalogLoader
            ready={!loading}
            reduced={reduced}
            onDone={finishIntro}
          />
        )}
      </>
    </Kitchen.Provider>
  )
}
