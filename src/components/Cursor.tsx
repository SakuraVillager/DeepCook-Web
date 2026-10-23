import { useEffect, useRef } from 'react'
import gsap from 'gsap'

type CursorProps = {
  reduced: boolean
}

export function Cursor({ reduced }: CursorProps) {
  const root = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (reduced) return
    if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return

    const el = root.current
    if (!el) return

    document.documentElement.classList.add('has-cursor')

    const dot = el.querySelector<HTMLElement>('.cursor__dot')
    const ring = el.querySelector<HTMLElement>('.cursor__ring')
    if (!dot || !ring) return

    const dotX = gsap.quickTo(dot, 'x', { duration: 0.12, ease: 'power2.out' })
    const dotY = gsap.quickTo(dot, 'y', { duration: 0.12, ease: 'power2.out' })
    const ringX = gsap.quickTo(ring, 'x', { duration: 0.5, ease: 'power3.out' })
    const ringY = gsap.quickTo(ring, 'y', { duration: 0.5, ease: 'power3.out' })

    let visible = false

    const onMove = (event: PointerEvent) => {
      if (!visible) {
        visible = true
        gsap.set([dot, ring], { x: event.clientX, y: event.clientY })
        gsap.to(el, { opacity: 1, duration: 0.3 })
      }
      dotX(event.clientX)
      dotY(event.clientY)
      ringX(event.clientX)
      ringY(event.clientY)

      const target = event.target as HTMLElement | null
      const interactive = target?.closest('a, button, [data-cursor="hover"]')
      el.classList.toggle('is-active', Boolean(interactive))
    }

    const onLeave = () => {
      visible = false
      gsap.to(el, { opacity: 0, duration: 0.25 })
    }

    window.addEventListener('pointermove', onMove, { passive: true })
    document.addEventListener('pointerleave', onLeave)

    return () => {
      window.removeEventListener('pointermove', onMove)
      document.removeEventListener('pointerleave', onLeave)
      document.documentElement.classList.remove('has-cursor')
    }
  }, [reduced])

  if (reduced) return null

  return (
    <div className="cursor" ref={root} aria-hidden="true">
      <span className="cursor__ring" />
      <span className="cursor__dot" />
    </div>
  )
}
