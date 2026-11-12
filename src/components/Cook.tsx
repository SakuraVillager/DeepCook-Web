import { useLayoutEffect, useRef, useState, type CSSProperties } from 'react'
import { cookSteps } from '../data/recipes'
import { ChapterLabel } from './ChapterLabel'
import { DesignCanvas } from './DesignCanvas'
import { getLenis } from '../lib/scroll'

export function Cook() {
  const [active, setActive] = useState(0)
  const section = useRef<HTMLElement>(null)
  const reader = useRef<HTMLDivElement>(null)
  const panel = useRef<HTMLDivElement>(null)
  const steps = useRef<Array<HTMLButtonElement | null>>([])
  const revealStep = useRef<((index: number) => void) | null>(null)

  useLayoutEffect(() => {
    const host = section.current,
      viewport = reader.current,
      content = panel.current
    if (!host || !viewport || !content) return
    let frame = 0,
      measurementFrame = 0,
      travel = 0,
      scale = 1,
      stopped = false

    const update = () => {
      frame = 0
      const distance = Math.max(
        0,
        Math.min(travel, -host.getBoundingClientRect().top),
      )
      content.style.setProperty('--cook-offset', `${-distance / scale}px`)
      if (distance <= 1) {
        setActive(0)
        return
      }
      if (distance >= travel - 1) {
        setActive(cookSteps.length - 1)
        return
      }
      const bounds = viewport.getBoundingClientRect()
      const focus = bounds.top + bounds.height / 2
      let best = 0,
        nearest = Infinity
      steps.current.forEach((node, index) => {
        if (!node) return
        const rect = node.getBoundingClientRect()
        const delta = Math.abs(rect.top + rect.height / 2 - focus)
        if (delta < nearest) {
          nearest = delta
          best = index
        }
      })
      setActive(best)
    }
    const measure = () => {
      measurementFrame = 0
      if (stopped || !viewport.clientHeight) return
      const nextScale =
        viewport.getBoundingClientRect().height / viewport.clientHeight
      if (nextScale <= 0) return
      scale = nextScale
      const nextTravel =
        Math.max(0, content.offsetHeight - viewport.clientHeight) * scale
      if (Math.abs(travel - nextTravel) > 0.1) {
        travel = nextTravel
        host.style.setProperty('--cook-travel', `${travel}px`)
        getLenis()?.resize()
      }
      cancelAnimationFrame(frame)
      update()
    }
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update)
    }
    const onResize = () => {
      if (!measurementFrame) measurementFrame = requestAnimationFrame(measure)
    }
    revealStep.current = (index) => {
      const node = steps.current[index]
      if (!node) return
      const offset = Math.max(
        0,
        Math.min(
          travel,
          (node.offsetTop + node.offsetHeight / 2 - viewport.clientHeight / 2) *
            scale,
        ),
      )
      const top = window.scrollY + host.getBoundingClientRect().top + offset
      const lenis = getLenis()
      if (lenis) lenis.scrollTo(top, { immediate: true })
      else window.scrollTo({ top, behavior: 'instant' })
      cancelAnimationFrame(frame)
      update()
    }
    const observer = new ResizeObserver(onResize)
    observer.observe(viewport)
    observer.observe(content)
    const canvas = host.querySelector('.design-canvas')
    if (canvas) observer.observe(canvas)
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
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onResize)
      cancelAnimationFrame(frame)
      cancelAnimationFrame(measurementFrame)
      revealStep.current = null
      host.style.removeProperty('--cook-travel')
      content.style.removeProperty('--cook-offset')
    }
  }, [])

  return (
    <section
      className="section chapter canvas-page cook"
      id="cook"
      data-theme="light"
      ref={section}
    >
      <div className="cook__viewport">
        <DesignCanvas
          className="container chapter__canvas"
          label="烹饪模式画布"
        >
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
                  <div>
                    大字号正文、步骤目录与进度，让手上忙的时候也看得清。
                  </div>
                </div>
              </div>

              <div className="cook__foot" data-reveal>
                <span>READER MODE</span>
                <span>步骤节选 · 红烧肉</span>
              </div>
            </div>

            <div
              className="cook__reader"
              ref={reader}
              role="region"
              aria-label="红烧肉步骤节选，随页面滚动阅读"
              tabIndex={0}
              data-reveal
            >
              <div className="cook__panel" ref={panel}>
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

                <div className="cook__steps">
                  {cookSteps.map((step, index) => (
                    <button
                      type="button"
                      className={`step${index === active ? ' is-active' : ''}`}
                      key={step.num}
                      ref={(node) => {
                        steps.current[index] = node
                      }}
                      onMouseEnter={() => setActive(index)}
                      onFocus={(event) => {
                        setActive(index)
                        if (event.currentTarget.matches(':focus-visible'))
                          revealStep.current?.(index)
                      }}
                      onClick={() => setActive(index)}
                      aria-current={index === active ? 'step' : undefined}
                    >
                      <span className="step__num">{step.num}</span>
                      <span className="step__copy">
                        <span className="step__title">{step.title}</span>
                        <span className="step__text">{step.text}</span>
                        {step.timer && (
                          <span className="step__timer">
                            识别到 {step.timer} · 点按计时
                          </span>
                        )}
                      </span>
                    </button>
                  ))}
                </div>

                <div className="cook__foot">
                  <span>共 15 步 · 此处节选 6 步 · 随页面滚动 ↓</span>
                  <span>返回详情后定位到当前步骤</span>
                </div>
              </div>
            </div>
          </div>
        </DesignCanvas>
      </div>
    </section>
  )
}
