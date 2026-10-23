import { useEffect, useRef } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { tickerWords } from '../data/recipes'

gsap.registerPlugin(ScrollTrigger)

type TickerProps = {
  reduced: boolean
}

export function Ticker({ reduced }: TickerProps) {
  const root = useRef<HTMLElement>(null)
  const track = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (reduced || !track.current || !root.current) return

    const ctx = gsap.context(() => {
      const loop = gsap.to(track.current, {
        xPercent: -50,
        duration: 34,
        ease: 'none',
        repeat: -1,
      })

      const skewTo = gsap.quickTo(track.current, 'skewX', {
        duration: 0.55,
        ease: 'power3.out',
      })

      ScrollTrigger.create({
        trigger: root.current,
        start: 'top bottom',
        end: 'bottom top',
        onUpdate: (self) => {
          const velocity = self.getVelocity()
          const boost = Math.min(Math.abs(velocity) / 1800, 2.4)
          loop.timeScale(1 + boost)
          skewTo(gsap.utils.clamp(-2.4, 2.4, velocity / 1400))
        },
        onLeave: () => {
          loop.timeScale(1)
          skewTo(0)
        },
        onLeaveBack: () => {
          loop.timeScale(1)
          skewTo(0)
        },
      })
    }, root)

    return () => ctx.revert()
  }, [reduced])

  const group = (
    <div className="ticker__group" aria-hidden="true">
      {tickerWords.map((word) => (
        <span className="ticker__word" key={word.zh}>
          {word.zh}
          <span className="ticker__en">{word.en}</span>
          <span className="ticker__star">✳</span>
        </span>
      ))}
    </div>
  )

  return (
    <section className="ticker" ref={root} aria-label="烹饪方式" data-theme="light">
      <div className="ticker__top">
        <span className="label">THE HEAT INDEX · 火候表</span>
        <span className="label">SEAR — SIMMER — REDUCE — REST</span>
      </div>
      <div className="ticker__track" ref={track}>
        {group}
        {group}
      </div>
    </section>
  )
}
