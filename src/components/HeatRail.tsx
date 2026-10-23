import { useEffect, useRef } from 'react'
import { heatSections } from '../data/recipes'
import { scrollToSection } from '../lib/scroll'

export function HeatRail() {
  const root = useRef<HTMLElement>(null)

  useEffect(() => {
    let frame = 0

    const update = () => {
      frame = 0
      const el = root.current
      if (!el) return

      const doc = document.documentElement
      const max = doc.scrollHeight - window.innerHeight
      const progress = max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0
      el.style.setProperty('--progress', progress.toFixed(4))

      let active = heatSections[0].id
      const line = window.innerHeight * 0.42
      for (const section of heatSections) {
        const target = document.getElementById(section.id)
        if (target && target.getBoundingClientRect().top <= line) {
          active = section.id
        }
      }

      el.querySelectorAll<HTMLElement>('[data-section]').forEach((item) => {
        item.classList.toggle('is-active', item.dataset.section === active)
        if (item.dataset.section === active) {
          item.setAttribute('aria-current', 'true')
        } else {
          item.removeAttribute('aria-current')
        }
      })

      const hidden = active === 'menu' || active === 'download'
      el.classList.toggle('is-hidden', hidden)
      el.toggleAttribute('inert', hidden)
    }

    const onScroll = () => {
      if (frame) return
      frame = window.requestAnimationFrame(update)
    }

    update()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)

    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
      if (frame) window.cancelAnimationFrame(frame)
    }
  }, [])

  return (
    <aside className="heat-rail" ref={root} aria-label="页面进度">
      <div className="heat-rail__track" aria-hidden="true">
        <i className="heat-rail__fill" />
      </div>
      <div className="heat-rail__list">
        {heatSections.map((section) => (
          <button
            key={section.id}
            type="button"
            className="heat-rail__item"
            data-section={section.id}
            onClick={() => scrollToSection(`#${section.id}`)}
            aria-label={`跳到 ${section.zh}`}
          >
            <span className="heat-rail__num">{section.num}</span>
            <span className="heat-rail__name">
              {section.name} · {section.zh}
            </span>
          </button>
        ))}
      </div>
    </aside>
  )
}
