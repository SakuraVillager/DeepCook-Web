import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { cookSteps } from '../data/recipes'
import { ChapterLabel } from './ChapterLabel'
import { DesignCanvas } from './DesignCanvas'

export function Cook() {
  const [active, setActive] = useState(0)
  const reader = useRef<HTMLDivElement>(null)
  const steps = useRef<Array<HTMLButtonElement | null>>([])

  useEffect(() => {
    const viewport = reader.current
    if (!viewport) return
    let frame = 0

    const update = () => {
      frame = 0
      const bounds = viewport.getBoundingClientRect()
      if (bounds.bottom <= 0 || bounds.top >= window.innerHeight) return

      if (viewport.scrollTop <= 1) {
        setActive(0)
        return
      }
      if (viewport.scrollTop + viewport.clientHeight >= viewport.scrollHeight - 1) {
        setActive(cookSteps.length - 1)
        return
      }

      const visibleTop = Math.max(0, bounds.top)
      const visibleBottom = Math.min(window.innerHeight, bounds.bottom)
      const focus = (visibleTop + visibleBottom) / 2
      let best = 0
      let distance = Number.POSITIVE_INFINITY

      steps.current.forEach((node, index) => {
        if (!node) return
        const rect = node.getBoundingClientRect()
        const center = rect.top + rect.height / 2
        const nextDistance = Math.abs(center - focus)
        if (nextDistance < distance) {
          distance = nextDistance
          best = index
        }
      })

      setActive(best)
    }

    const onScroll = () => {
      if (frame) return
      frame = window.requestAnimationFrame(update)
    }

    update()
    const observer = new ResizeObserver(onScroll)
    observer.observe(viewport)
    viewport.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)

    return () => {
      observer.disconnect()
      viewport.removeEventListener('scroll', onScroll)
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
      if (frame) window.cancelAnimationFrame(frame)
    }
  }, [])

  return (
    <section className="section chapter canvas-page cook" id="cook" data-theme="light">
      <DesignCanvas className="container chapter__canvas" label="烹饪模式画布">
        <ChapterLabel index="03" title="COOK" heat="大火 · HIGH HEAT" />
        <div className="cook__grid">
          <div className="cook__left">
            <h2 className="h2" data-reveal>
              一步一步，
              <br />
              不慌不忙。
            </h2>

            <p className="body-lg cook__description" data-reveal>
              烹饪模式把一步铺满一屏。翻步只看当前一步，步骤目录随时跳转；返回详情时，
              还会回到你刚才读到的那一步。
            </p>

            <div className="cook__points" data-reveal>
              <div className="cook__point">
                <span>01</span>
                <div>
                  识别到明确时长的步骤，点一下就能开始计时。
                  <br />
                  焯水、炖煮可以同时挂几个计时器。
                </div>
              </div>
              <div className="cook__point">
                <span>02</span>
                <div>锁屏、退出、重启之后，计时器仍会按时提醒。</div>
              </div>
              <div className="cook__point">
                <span>03</span>
                <div>大字号正文、步骤目录与进度，让手上忙的时候也看得清。</div>
              </div>
            </div>

            <div className="cook__foot" data-reveal>
              <span>READER MODE</span>
              <span>步骤节选 · 红烧肉</span>
            </div>
          </div>

          <div className="cook__panel" data-reveal>
            <div className="cook__panel-head">
              <div>
                <span className="label">烹饪模式 / 步骤节选</span>
                <h3 className="cook__recipe-title">红烧肉</h3>
              </div>
              <span className="cook__counter">
                <b>0{active + 1}</b> / 06
              </span>
            </div>

            <div
              className="cook__progress"
              role="progressbar"
              aria-valuemin={1}
              aria-valuemax={6}
              aria-valuenow={active + 1}
              aria-label="步骤进度"
              style={{ '--p': (active + 1) / 6 } as CSSProperties}
            >
              <i />
            </div>

            <div className="timer">
              <div className="timer__left">
                <span className="timer__dot" aria-hidden="true" />
                <div className="timer__label">
                  炖煮中 · 小火慢炖
                  <small>焯水 15:00 已完成</small>
                </div>
              </div>
              <div className="timer__time">42:18</div>
            </div>

            <div
              className="cook__steps"
              ref={reader}
              role="region"
              aria-label="红烧肉步骤节选，可纵向滚动"
              tabIndex={0}
              data-lenis-prevent
            >
              {cookSteps.map((step, index) => (
                <button
                  type="button"
                  className={`step${index === active ? ' is-active' : ''}`}
                  key={step.num}
                  ref={(node) => {
                    steps.current[index] = node
                  }}
                  onMouseEnter={() => setActive(index)}
                  onFocus={() => setActive(index)}
                  onClick={() => setActive(index)}
                  aria-current={index === active ? 'step' : undefined}
                >
                  <span className="step__num">{step.num}</span>
                  <span className="step__copy">
                    <span className="step__title">{step.title}</span>
                    <span className="step__text">{step.text}</span>
                    {step.timer && (
                      <span className="step__timer">识别到 {step.timer} · 点按计时</span>
                    )}
                  </span>
                </button>
              ))}
            </div>

            <div className="cook__foot">
              <span>共 15 步 · 此处节选 6 步 · 区域内滚动 ↓</span>
              <span>返回详情后定位到当前步骤</span>
            </div>
          </div>
        </div>
      </DesignCanvas>
    </section>
  )
}
