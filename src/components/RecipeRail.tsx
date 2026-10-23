import { useEffect, useRef, useState } from 'react'
import { menuRecipes } from '../data/recipes'
import { LetterLink } from './LetterLink'

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

  useEffect(() => {
    const el = viewport.current
    if (!el) return

    const update = () => {
      const max = el.scrollWidth - el.clientWidth
      setAtStart(el.scrollLeft <= 4)
      setAtEnd(el.scrollLeft >= max - 4)
    }

    update()
    el.addEventListener('scroll', update, { passive: true })
    const observer = new ResizeObserver(update)
    observer.observe(el)

    return () => {
      el.removeEventListener('scroll', update)
      observer.disconnect()
    }
  }, [])

  const move = (direction: -1 | 1) => {
    const el = viewport.current
    if (!el) return
    const card = el.querySelector<HTMLElement>('.recipe-card')
    const step = card ? card.offsetWidth + 18 : el.clientWidth * 0.8
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    el.scrollBy({ left: direction * step, behavior: reduced ? 'auto' : 'smooth' })
  }

  return (
    <div className="showcase" data-reveal>
      <div className="showcase__head">
        <div className="showcase__intro">
          <span className="label showcase__kicker">TONIGHT · 06 DISHES / FROM 494</span>
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
        aria-label="精选菜谱，可横向滚动"
      >
        <div className="showcase__track">
          {menuRecipes.map((recipe, index) => (
            <a
              className="recipe-card"
              key={recipe.id}
              href={`./app/?recipe=${recipe.id}`}
              aria-label={`${recipe.title}，在在线版中查看（准备中）`}
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
                  <span style={{ marginLeft: 'auto' }}>{recipe.titleEn}</span>
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
                在线版整理中，入口先留给你。
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
        <span className="label">SCROLL → 横向滑动</span>
      </div>
    </div>
  )
}
