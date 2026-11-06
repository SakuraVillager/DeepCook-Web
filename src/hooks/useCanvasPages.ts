import { useEffect } from 'react'
import { getLenis } from '../lib/scroll'

/** Preserve the active canvas page when its viewport changes size. */
export function useCanvasPages(enabled: boolean) {
  useEffect(() => {
    if (!enabled) return

    const pages = Array.from(document.querySelectorAll<HTMLElement>('#main > section, footer.footer'))
    let anchor: { element: HTMLElement; fraction: number } | null = null
    let resizeFrame = 0
    let initialFrame = 0

    const moveImmediately = (target: number | HTMLElement) => {
      const top = typeof target === 'number'
        ? target
        : window.scrollY + target.getBoundingClientRect().top
      const lenis = getLenis()
      if (lenis) {
        lenis.resize()
        lenis.scrollTo(top, { immediate: true, force: true })
      } else {
        window.scrollTo({ top, behavior: 'instant' })
      }
    }

    const captureAnchor = () => {
      const element = pages.find(page => {
        const rect = page.getBoundingClientRect()
        return rect.top <= 1 && rect.bottom > 1
      })
      anchor = element ? {
        element,
        fraction: -element.getBoundingClientRect().top / element.offsetHeight,
      } : null
    }

    const onScroll = () => { if (!resizeFrame) captureAnchor() }

    const onResize = () => {
      if (resizeFrame) window.cancelAnimationFrame(resizeFrame)
      resizeFrame = window.requestAnimationFrame(() => {
        if (anchor?.element.classList.contains('canvas-page')) {
          const { element, fraction } = anchor
          moveImmediately(window.scrollY + element.getBoundingClientRect().top + fraction * element.offsetHeight)
        }
        resizeFrame = 0
        captureAnchor()
      })
    }

    // Align after load so native history restoration cannot overwrite the anchor.
    const alignInitialAnchor = () => {
      initialFrame = window.requestAnimationFrame(() => {
        let id = ''
        try {
          id = decodeURIComponent(window.location.hash.slice(1))
        } catch {
          return
        }
        const target = id ? document.getElementById(id) : null
        if (target) moveImmediately(target)
        captureAnchor()
      })
    }
    if (document.readyState === 'complete') alignInitialAnchor()
    else window.addEventListener('load', alignInitialAnchor, { once: true })
    captureAnchor()

    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onResize)
    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onResize)
      window.removeEventListener('load', alignInitialAnchor)
      window.cancelAnimationFrame(initialFrame)
      if (resizeFrame) window.cancelAnimationFrame(resizeFrame)
    }
  }, [enabled])
}
