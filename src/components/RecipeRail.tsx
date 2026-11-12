import { useLayoutEffect, useRef, useState } from 'react'
import { menuRecipes } from '../data/recipes'
import { LetterLink } from './LetterLink'
import { getLenis } from '../lib/scroll'

function metaFor(recipe: (typeof menuRecipes)[number]) {
  const region = recipe.region !== '无' ? recipe.region : ''
  const categories = recipe.categories.join(' · ')
  return [region, categories, recipe.servings !== '无' ? recipe.servings : '']
    .filter(Boolean)
    .join(' · ')
}

function Chevron({ direction }: { direction: 'prev' | 'next' }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d={direction === 'prev' ? 'M15 5 8 12l7 7' : 'M9 5l7 7-7 7'}
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function RecipeRail() {
  const viewport = useRef<HTMLDivElement>(null)
  const [atStart, setAtStart] = useState(true)
  const [atEnd, setAtEnd] = useState(false)

  const moveTo = useRef<((left: number, immediate?: boolean) => void) | null>(
    null,
  )

  useLayoutEffect(() => {
    const el = viewport.current
    const host = el?.closest<HTMLElement>('#features')
    if (!el || !host) return
    let frame = 0,
      resizeFrame = 0,
      expected = 0,
      scale = 1,
      travel = 0,
      stopped = false
    const maxScroll = () => Math.max(0, el.scrollWidth - el.clientWidth)
    const update = () => {
      frame = 0
      const distance = Math.max(
        0,
        Math.min(travel, -host.getBoundingClientRect().top),
      )
      expected = Math.max(0, Math.min(maxScroll(), distance / scale))
      if (Math.abs(el.scrollLeft - expected) > 0.5) el.scrollLeft = expected
      setAtStart(expected <= 4)
      setAtEnd(expected >= maxScroll() - 4)
    }
    const jump = (left: number, immediate = false) => {
      const top =
        window.scrollY +
        host.getBoundingClientRect().top +
        Math.max(0, Math.min(maxScroll(), left)) * scale
      const lenis = getLenis()
      const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches
      if (lenis)
        lenis.scrollTo(top, { immediate: immediate || reduced, duration: 0.55 })
      else
        window.scrollTo({
          top,
          behavior: immediate || reduced ? 'instant' : 'smooth',
        })
      if (immediate || reduced) update()
    }
    const measure = () => {
      resizeFrame = 0
      const nextScale = parseFloat(
        getComputedStyle(el).getPropertyValue('--canvas-scale'),
      )
      if (!Number.isFinite(nextScale) || nextScale <= 0) return
      scale = nextScale
      const next = maxScroll() * scale
      if (Math.abs(travel - next) > 0.1) {
        travel = next
        host.style.setProperty('--find-travel', `${travel}px`)
        getLenis()?.resize()
      }
      cancelAnimationFrame(frame)
      update()
    }
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update)
    }
    const onResize = () => {
      if (!resizeFrame) resizeFrame = requestAnimationFrame(measure)
    }
    const onRailScroll = () => {
      if (Math.abs(el.scrollLeft - expected) > 1) jump(el.scrollLeft, true)
    }
    moveTo.current = jump
    const observer = new ResizeObserver(onResize)
    observer.observe(el)
    if (el.firstElementChild) observer.observe(el.firstElementChild)
    const canvas = host.querySelector('.design-canvas')
    if (canvas) observer.observe(canvas)
    el.addEventListener('scroll', onRailScroll, { passive: true })
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onResize)
    void document.fonts.ready.then(() => {
      if (!stopped) onResize()
    })
    measure()
    onResize()
    return () => {
      stopped = true
      observer.disconnect()
      cancelAnimationFrame(frame)
      cancelAnimationFrame(resizeFrame)
      el.removeEventListener('scroll', onRailScroll)
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onResize)
      host.style.removeProperty('--find-travel')
      moveTo.current = null
    }
  }, [])

  const move = (direction: -1 | 1) => {
    const el = viewport.current
    if (!el) return
    const card = el.querySelector<HTMLElement>('.recipe-card')
    const step = card ? card.offsetWidth + 18 : el.clientWidth * 0.8
    moveTo.current?.(el.scrollLeft + direction * step)
  }

  return (
    <div className="showcase" data-reveal>
      <div className="showcase__head">
        <div className="showcase__intro">
          <span className="label showcase__kicker">
            TONIGHT · 06 DISHES / FROM 494
          </span>
          <h3 className="showcase__title">今天，想做点什么？</h3>
          <p className="showcase__sub">
            6 道精选，来自 494 道离线菜谱；未标注的用时与难度不猜测。
          </p>
        </div>
        <div className="showcase__controls">
          <button
            type="button"
            className="showcase__btn"
            aria-label="上一道菜"
            disabled={atStart}
            onClick={() => move(-1)}
          >
            <Chevron direction="prev" />
          </button>
          <button
            type="button"
            className="showcase__btn"
            aria-label="下一道菜"
            disabled={atEnd}
            onClick={() => move(1)}
          >
            <Chevron direction="next" />
          </button>
        </div>
      </div>

      <div
        className="showcase__viewport"
        ref={viewport}
        tabIndex={0}
        role="region"
        aria-label="精选菜谱，随页面滚动横向浏览，也可横向滑动"
      >
        <div className="showcase__track">
          {menuRecipes.map((recipe, index) => (
            <a
              className="recipe-card"
              key={recipe.id}
              href={`./app/?recipe=${recipe.id}`}
              aria-label={`${recipe.title}，在在线版中查看`}
            >
              <div className="recipe-card__media">
                <img
                  src={recipe.cover}
                  alt={`${recipe.title}的菜谱封面`}
                  loading="lazy"
                  decoding="async"
                />
                <span className="recipe-card__badge">
                  {String(index + 1).padStart(2, '0')} /{' '}
                  {recipe.region === '无' ? '家常' : recipe.region}
                </span>
              </div>
              <div className="recipe-card__body">
                <div className="recipe-card__title-row">
                  <h4 className="recipe-card__title">{recipe.title}</h4>
                  <span className="recipe-card__go" aria-hidden="true">
                    <span className="arrow" />
                  </span>
                </div>
                <div className="recipe-card__meta">{metaFor(recipe)}</div>
                <div className="recipe-card__foot">
                  {recipe.minutes ? (
                    <span>
                      <b>{recipe.minutes}</b> MIN
                    </span>
                  ) : (
                    <span>用时 · 原文未标注</span>
                  )}
                  {recipe.difficulty ? (
                    <span>
                      难度 <b>{recipe.difficulty}</b>
                    </span>
                  ) : null}
                  <span className="recipe-card__english">{recipe.titleEn}</span>
                </div>
              </div>
            </a>
          ))}

          <div className="showcase-card-end">
            <div>
              <div className="showcase-card-end__big">494</div>
              <p className="showcase-card-end__label">
                道菜谱全部收录在 App 内。
                <br />
                打开在线版，继续寻找今晚的好菜。
              </p>
            </div>
            <LetterLink
              text="全部菜谱"
              href="./app/"
              className="showcase-card-end__cta label"
              arrow
            />
          </div>
        </div>
      </div>

      <div className="showcase__foot">
        <span className="label">SCROLL ↓ 向下滚动，横向浏览</span>
      </div>
    </div>
  )
}
