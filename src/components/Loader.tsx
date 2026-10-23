import { useEffect, useRef } from 'react'
import gsap from 'gsap'

type LoaderProps = {
  reduced: boolean
  onDone: () => void
}

export function Loader({ reduced, onDone }: LoaderProps) {
  const root = useRef<HTMLDivElement>(null)
  const counter = useRef<HTMLSpanElement>(null)
  const bar = useRef<HTMLElement>(null)
  const onDoneRef = useRef(onDone)

  useEffect(() => {
    onDoneRef.current = onDone
  }, [onDone])

  useEffect(() => {
    document.body.classList.add('is-locked')

    if (reduced) {
      document.body.classList.remove('is-locked')
      onDoneRef.current()
      return
    }

    const state = { value: 0 }
    const tl = gsap.timeline({
      onComplete: () => {
        document.body.classList.remove('is-locked')
        onDoneRef.current()
      },
    })

    tl.to(state, {
      value: 100,
      duration: 1.15,
      ease: 'power2.inOut',
      onUpdate: () => {
        if (counter.current) {
          counter.current.textContent = String(Math.round(state.value)).padStart(3, '0')
        }
      },
    })

    if (bar.current) {
      tl.to(bar.current, { scaleX: 1, duration: 1.15, ease: 'power2.inOut' }, 0)
    }

    tl.to(
      root.current,
      {
        clipPath: 'inset(0 0 100% 0)',
        duration: 1.05,
        ease: 'power4.inOut',
      },
      '+=0.18',
    )

    return () => {
      tl.kill()
      document.body.classList.remove('is-locked')
    }
  }, [reduced])

  return (
    <div className="loader" ref={root} aria-hidden="true">
      <div className="loader__top">
        <span className="loader__brand">DEEPCOOK</span>
        <span className="label loader__meta">KITCHEN NOTES / 001</span>
      </div>

      <div className="loader__center">
        <div className="loader__count">
          <span ref={counter}>000</span>
          <span>%</span>
        </div>
        <div className="loader__lines">
          <span className="label">PREPARING THE KITCHEN</span>
          <span className="label">OFFLINE · 494 RECIPES</span>
        </div>
      </div>

      <div>
        <p className="loader__phrase">
          把每一道菜，做深一点。
          <br />
          DeepCook — 深度菜谱
        </p>
        <div className="loader__bar">
          <i ref={bar} />
        </div>
      </div>
    </div>
  )
}
