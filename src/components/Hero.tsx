import { useEffect, useId, useRef } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { LetterLink } from './LetterLink'

gsap.registerPlugin(ScrollTrigger)

type HeroProps = {
  play: boolean
  reduced: boolean
}

const slides = [
  { src: './photos/eu-paella.jpg', alt: '铺满虾和青口贝的西班牙海鲜饭' },
  { src: './photos/eu-beef-bourguignon.jpg', alt: '冒着热气的红酒炖牛肉' },
  { src: './photos/cn-xiaolongbao.jpg', alt: '竹笼里刚出笼的小笼包' },
]

function Stamp() {
  const id = useId().replace(/:/g, '')
  const pathId = `stamp-${id}`

  return (
    <div className="stamp" aria-hidden="true">
      <svg viewBox="0 0 120 120">
        <defs>
          <path
            id={pathId}
            d="M60,60 m-45,0 a45,45 0 1,1 90,0 a45,45 0 1,1 -90,0"
          />
        </defs>
        <text>
          <textPath href={`#${pathId}`} textLength={274} lengthAdjust="spacing">EAT WELL · COOK DEEPER · 好好吃饭 · </textPath>
        </text>
      </svg>
      <span className="stamp__center">炊</span>
    </div>
  )
}

export function Hero({ play, reduced }: HeroProps) {
  const root = useRef<HTMLElement>(null)

  useEffect(() => {
    if (!root.current) return

    const ctx = gsap.context(() => {
      const chars = gsap.utils.toArray<HTMLElement>('.split-char')
      const revealItems = gsap.utils.toArray<HTMLElement>('.hero-reveal')

      if (reduced) {
        gsap.set(chars, { yPercent: 0, opacity: 1 })
        gsap.set(revealItems, { y: 0, opacity: 1 })
        return
      }

      if (!play) return

      const tl = gsap.timeline({ defaults: { ease: 'expo.out' } })
      tl.fromTo(
        chars,
        { yPercent: 118, opacity: 0 },
        { yPercent: 0, opacity: 1, duration: 1.25, stagger: 0.036 },
        0,
      )
        .fromTo(
          '.hero__eyebrow',
          { y: 22, opacity: 0 },
          { y: 0, opacity: 1, duration: 0.9 },
          0.35,
        )
        .fromTo(
          '.stamp',
          { scale: 0.7, opacity: 0, rotate: -30 },
          { scale: 1, opacity: 1, rotate: 0, duration: 1.1, ease: 'power3.out' },
          0.5,
        )
        .fromTo(
          revealItems,
          { y: 34, opacity: 0 },
          { y: 0, opacity: 1, duration: 1, stagger: 0.09 },
          0.55,
        )
    }, root)

    return () => ctx.revert()
  }, [play, reduced])

  useEffect(() => {
    if (!play || reduced) return
    const el = root.current
    if (!el) return

    const images = Array.from(el.querySelectorAll<HTMLElement>('.hero__slide'))
    let active = 0
    const interval = window.setInterval(() => {
      const next = (active + 1) % images.length
      gsap.to(images[active], { opacity: 0, duration: 1.5, ease: 'power2.inOut' })
      gsap.to(images[next], { opacity: 1, duration: 1.5, ease: 'power2.inOut' })
      active = next
    }, 6800)

    return () => window.clearInterval(interval)
  }, [play, reduced])

  useEffect(() => {
    if (reduced || !root.current) return

    const mm = gsap.matchMedia()
    mm.add('(min-width: 900px)', () => {
      gsap.to('.hero__title', {
        yPercent: -11,
        ease: 'none',
        scrollTrigger: {
          trigger: root.current,
          start: 'top top',
          end: 'bottom top',
          scrub: true,
        },
      })

      gsap.to('.hero__eyebrow, .stamp', {
        yPercent: 18,
        opacity: 0.35,
        ease: 'none',
        scrollTrigger: {
          trigger: root.current,
          start: 'top top',
          end: 'bottom top',
          scrub: true,
        },
      })
    })

    return () => mm.revert()
  }, [reduced])

  return (
    <section className="hero" id="top" ref={root} aria-label="DeepCook 首页" data-theme="dark">
      <div className="hero__slides" aria-hidden="true">
        {slides.map((slide, index) => (
          <div
            className="hero__slide"
            key={slide.src}
            style={{ opacity: index === 0 ? 1 : 0 }}
          >
            <img
              src={slide.src}
              alt={index === 0 ? slide.alt : ''}
              fetchPriority={index === 0 ? 'high' : 'auto'}
            />
          </div>
        ))}
      </div>
      <div className="hero__scrim" aria-hidden="true" />

      <div className="hero__inner">
        <div className="hero__top">
          <div className="hero__eyebrow">
            <span className="label">DEEPCOOK — 深度菜谱</span>
            <span className="hero__eyebrow-line">494 RECIPES · OFFLINE FIRST · ANDROID</span>
          </div>
          <Stamp />
        </div>

        <div className="hero__spacer" />

        <h1 className="hero__title" aria-label="Cook deeper，把每一道菜，做深一点">
          <span className="hero__title-line">
            {'COOK'.split('').map((char, index) => (
              <span className="split-char" key={`cook-${index}`}>
                {char}
              </span>
            ))}
          </span>
          <span className="hero__title-line hero__title-line--serif">
            {'DEEPER.'.split('').map((char, index) => (
              <span className="split-char" key={`deeper-${index}`}>
                {char}
              </span>
            ))}
          </span>
        </h1>

        <div className="hero__bottom">
          <div className="hero__lead">
            <p className="hero__cn hero-reveal">把每一道菜，做深一点。</p>
            <p className="hero__desc hero-reveal">
              494 道中文菜谱，从找到、看懂到做完。步骤、火候与营养，离线也讲得清楚。
            </p>
            <div className="hero__ctas hero-reveal">
              <LetterLink
                text="下载 Android 版"
                href="./download/DeepCook-0.5.1-preview.apk"
                download
                className="btn"
                arrow
              />
              <LetterLink
                text="在线使用"
                href="./app/"
                className="btn btn--ghost"
                arrow
              />
            </div>
          </div>

          <div className="hero__meta hero-reveal">
            <div className="hero__meta-lines">
              <span>VERSION 0.5.1</span>
              <span>ANDROID 8.0+ · 17.5 MB</span>
              <span>完全离线可用</span>
            </div>
            <div className="hero__scroll">
              <span>SCROLL TO COOK</span>
              <i />
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
