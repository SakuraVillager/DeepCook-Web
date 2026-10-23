import type Lenis from 'lenis'

let instance: Lenis | null = null

export function setLenis(next: Lenis | null) {
  instance = next
}

export function getLenis() {
  return instance
}

export function stopScroll() {
  instance?.stop()
}

export function startScroll() {
  instance?.start()
}

export function scrollToSection(target: string) {
  const el = document.querySelector<HTMLElement>(target)
  if (!el) return

  if (instance) {
    instance.scrollTo(el, { offset: 0, duration: 1.35 })
  } else {
    el.scrollIntoView({ behavior: 'smooth' })
  }

  if (window.location.hash !== target) {
    window.history.replaceState(null, '', target)
  }
}

export function scrollToTop() {
  if (instance) {
    instance.scrollTo(0, { duration: 1.3 })
  } else {
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }
  window.history.replaceState(null, '', window.location.pathname)
}
