import { useEffect, useRef } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { menuRecipes } from '../data/recipes'
import { LetterLink } from './LetterLink'

gsap.registerPlugin(ScrollTrigger)

type MenuRailProps = {
  reduced: boolean
}

function metaFor(recipe: (typeof menuRecipes)[number]) {
  const region = recipe.region !== '无' ? recipe.region : ''
  const categories = recipe.categories.join(' · ')
  return [region, categories, recipe.servings !== '无' ? recipe.servings : '']
    .filter(Boolean)
    .join(' · ')
}

export function MenuRail({ reduced }: MenuRailProps) {
  const section = useRef<HTMLElement>(null)
  const track = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (reduced) return
    if (!section.current || !track.current) return

    const mm = gsap.matchMedia()

    mm.add('(min-width: 900px)', () => {
      const el = track.current
      const sec = section.current
      if (!el || !sec) return

      const distance = () =>
        Math.max(0, el.scrollWidth - sec.clientWidth + window.innerWidth * 0.04)

      if (distance() < 60) return

      gsap.to(el, {
        x: () => -distance(),
        ease: 'none',
        scrollTrigger: {
          trigger: sec,
          start: 'top top',
          end: () => `+=${distance() + window.innerHeight * 0.35}`,
          pin: true,
          scrub: 1,
          anticipatePin: 1,
          invalidateOnRefresh: true,
        },
      })
    })

    return () => mm.revert()
  }, [reduced])

  return (
    <section className="menu" id="menu" ref={section} aria-labelledby="menu-title" data-theme="light">
      <div className="menu__pin">
        <div className="menu__head">
          <div>
            <div className="sec-head__label" style={{ paddingTop: 0, marginBottom: 18 }}>
              <span className="heat-tag">上菜 · SERVE</span>
              <span className="label">05 / TONIGHT</span>
            </div>
            <h2 className="menu__title" id="menu-title" data-reveal>
              今天，想做点什么？
            </h2>
          </div>
          <div className="menu__meta">
            <strong>06 DISHES / FROM 494</strong>
            菜谱元数据沿用 App 原文
            <br />
            未标注用时或难度时，不猜测
            <br />
            <span className="menu__scroll">SCROLL → 横向滑动</span>
          </div>
        </div>

        <div className="menu__viewport">
          <div className="menu__track" ref={track}>
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
                    {String(index + 1).padStart(2, '0')} / {recipe.region === '无' ? '家常' : recipe.region}
                  </span>
                </div>
                <div className="recipe-card__body">
                  <div className="recipe-card__title-row">
                    <h3 className="recipe-card__title">{recipe.title}</h3>
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

            <div className="menu-card-end">
              <div>
                <div className="menu-card-end__big">494</div>
                <p className="menu-card-end__label">
                  道菜谱全部收录在 App 内。
                  <br />
                  在线版整理中，先把入口留给你。
                </p>
              </div>
              <LetterLink
                text="全部菜谱"
                href="./app/"
                className="menu-card-end__cta label"
                arrow
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
