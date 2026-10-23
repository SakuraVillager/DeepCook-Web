import { useEffect } from 'react'

/**
 * Reveals any [data-reveal] element once it enters the viewport.
 * The CSS owns the animation; this hook only toggles `.is-in`.
 */
export function useReveal(enabled: boolean) {
  useEffect(() => {
    if (!enabled) return

    const nodes = Array.from(document.querySelectorAll<HTMLElement>('[data-reveal]'))
    if (!nodes.length) return

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue
          entry.target.classList.add('is-in')
          observer.unobserve(entry.target)
        }
      },
      { threshold: 0.12, rootMargin: '0px 0px -6% 0px' },
    )

    nodes.forEach((node) => observer.observe(node))
    return () => observer.disconnect()
  }, [enabled])
}
