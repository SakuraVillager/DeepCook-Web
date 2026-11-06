import { useEffect, useRef } from 'react'
import gsap from 'gsap'

type CursorProps = {
  reduced: boolean
  variant?: 'home' | 'online'
}

export function Cursor({ reduced, variant = 'home' }: CursorProps) {
  const root = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (reduced) return
    if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return

    const el = root.current
    if (!el) return

    document.documentElement.classList.add('has-cursor')

    const dot = el.querySelector<HTMLElement>('.cursor__anchor--dot')
    const ring = el.querySelector<HTMLElement>('.cursor__anchor--ring')
    if (!dot || !ring) return

    const dotX = gsap.quickTo(dot, 'x', { duration: 0.12, ease: 'power2.out' })
    const dotY = gsap.quickTo(dot, 'y', { duration: 0.12, ease: 'power2.out' })
    const ringX = gsap.quickTo(ring, 'x', { duration: 0.5, ease: 'power3.out' })
    const ringY = gsap.quickTo(ring, 'y', { duration: 0.5, ease: 'power3.out' })
    const followers = [dotX, dotY, ringX, ringY]

    let visible = false

    const onMove = (event: PointerEvent) => {
      if (!visible) {
        visible = true
        followers.forEach((move) => move.tween.pause().invalidate())
        gsap.set([dot, ring], { x: event.clientX, y: event.clientY })
        gsap.to(el, { opacity: 1, duration: 0.3, overwrite: true })
      } else {
        dotX(event.clientX)
        dotY(event.clientY)
        ringX(event.clientX)
        ringY(event.clientY)
      }

      const target = event.target as HTMLElement | null
      const interactive = target?.closest('a, button, [data-cursor="hover"]')
      el.classList.toggle('is-active', Boolean(interactive))
    }

    const onLeave = () => {
      visible = false
      gsap.to(el, { opacity: 0, duration: 0.25, overwrite: true })
    }

    window.addEventListener('pointermove', onMove, { passive: true })
    document.addEventListener('pointerleave', onLeave)

    return () => {
      window.removeEventListener('pointermove', onMove)
      document.removeEventListener('pointerleave', onLeave)
      followers.forEach((move) => move.tween.kill())
      gsap.killTweensOf([el, dot, ring])
      document.documentElement.classList.remove('has-cursor')
    }
  }, [reduced])

  if (reduced) return null

  return (
    <div className={`cursor cursor--${variant}`} ref={root} aria-hidden="true">
      <span className="cursor__anchor cursor__anchor--ring">
        <span className="cursor__ring" />
      </span>
      <span className="cursor__anchor cursor__anchor--dot">
        <span className="cursor__dot" />
      </span>
    </div>
  )
}
