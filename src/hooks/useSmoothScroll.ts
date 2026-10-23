import { useEffect } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import Lenis from 'lenis'
import { setLenis } from '../lib/scroll'

gsap.registerPlugin(ScrollTrigger)

export function useSmoothScroll(enabled: boolean) {
  useEffect(() => {
    if (!enabled) {
      document.documentElement.classList.add('no-motion')
      return () => {
        document.documentElement.classList.remove('no-motion')
      }
    }

    document.documentElement.classList.remove('no-motion')

    const lenis = new Lenis({
      duration: 1.15,
      smoothWheel: true,
      wheelMultiplier: 1,
      touchMultiplier: 1.4,
    })

    setLenis(lenis)
    lenis.on('scroll', ScrollTrigger.update)

    const raf = (time: number) => lenis.raf(time * 1000)
    gsap.ticker.add(raf)
    gsap.ticker.lagSmoothing(0)

    const refresh = () => ScrollTrigger.refresh()
    window.addEventListener('load', refresh)
    const timer = window.setTimeout(refresh, 500)

    return () => {
      window.removeEventListener('load', refresh)
      window.clearTimeout(timer)
      gsap.ticker.remove(raf)
      lenis.destroy()
      setLenis(null)
      document.documentElement.classList.remove('no-motion')
    }
  }, [enabled])
}
