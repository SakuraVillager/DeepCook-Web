import { useEffect, useRef } from 'react'
import gsap from 'gsap'

type CatalogLoaderProps = {
  ready: boolean
  reduced: boolean
  onDone: () => void
}

/** Match the homepage's counter and upward reveal, but wait for the actual catalog. */
export function CatalogLoader({ ready, reduced, onDone }: CatalogLoaderProps) {
  const root = useRef<HTMLDivElement>(null)
  const count = useRef<HTMLSpanElement>(null)
  const bar = useRef<HTMLElement>(null)
  const state = useRef({ value: 0 })
  const started = useRef(0)
  const progress = useRef<gsap.core.Tween | null>(null)
  const finish = useRef<gsap.core.Timeline | null>(null)
  const done = useRef(onDone)
  done.current = onDone

  const update = () => {
    if (count.current)
      count.current.textContent = String(
        Math.round(state.current.value),
      ).padStart(3, '0')
    if (bar.current)
      bar.current.style.transform = `scaleX(${state.current.value / 100})`
  }

  useEffect(() => {
    document.body.classList.add('is-locked')
    started.current = performance.now()
    state.current.value = 0
    update()
    if (!reduced)
      progress.current = gsap.to(state.current, {
        value: 88,
        duration: 1.5,
        ease: 'power2.out',
        onUpdate: update,
      })
    return () => {
      progress.current?.kill()
      finish.current?.kill()
      document.body.classList.remove('is-locked')
    }
  }, [reduced])

  useEffect(() => {
    if (!ready) return
    if (reduced) {
      done.current()
      return
    }
    // Keep the headline readable even when the catalog is served from cache.
    const timer = window.setTimeout(
      () => {
        progress.current?.kill()
        finish.current = gsap
          .timeline({ onComplete: () => done.current() })
          .to(state.current, {
            value: 100,
            duration: 0.25,
            ease: 'power2.out',
            onUpdate: update,
          })
          .to(
            root.current,
            {
              clipPath: 'inset(0 0 100% 0)',
              duration: 0.7,
              ease: 'power4.inOut',
            },
            '+=0.1',
          )
      },
      Math.max(0, 1600 - (performance.now() - started.current)),
    )
    return () => {
      window.clearTimeout(timer)
      finish.current?.kill()
    }
  }, [ready, reduced])

  return (
    <div
      className="k-loading"
      ref={root}
      role="status"
      aria-live="polite"
      aria-label="正在翻开菜谱"
    >
      <div className="k-loading__top">
        <span className="k-loading__brand">DEEPCOOK</span>
        <span className="label">THE ONLINE EDITION / RECIPE BOOK</span>
      </div>
      <div className="k-loading__center">
        <div>
          <span className="label">OPENING THE RECIPE BOOK</span>
          <p className="k-loading__title">
            正在翻开<span>菜谱。</span>
          </p>
        </div>
        <div className="k-loading__counter" aria-hidden="true">
          <span ref={count}>000</span>
          <small>%</small>
        </div>
      </div>
      <div className="k-loading__bottom">
        <div>
          <p>好好吃饭，慢慢下厨。</p>
          <span className="label">A LITTLE CARE. A BETTER MEAL.</span>
        </div>
        <div className="k-loading__bar" aria-hidden="true">
          <i ref={bar} />
        </div>
      </div>
    </div>
  )
}
