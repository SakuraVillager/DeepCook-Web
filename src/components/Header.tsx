import { useEffect, useState, type MouseEvent } from 'react'
import { LetterLink } from './LetterLink'
import { navItems } from '../data/recipes'
import { scrollToSection, scrollToTop, startScroll, stopScroll } from '../lib/scroll'

export function Header() {
  const [open, setOpen] = useState(false)
  const [onLight, setOnLight] = useState(false)

  useEffect(() => {
    let frame = 0

    const update = () => {
      frame = 0
      const probe = 38
      const sections = Array.from(document.querySelectorAll<HTMLElement>('[data-theme]'))
      let light = false
      for (const section of sections) {
        const rect = section.getBoundingClientRect()
        if (rect.top <= probe && rect.bottom > probe) {
          light = section.dataset.theme === 'light'
          break
        }
      }
      setOnLight(light)
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

  useEffect(() => {
    if (!open) return

    stopScroll()
    document.body.classList.add('is-locked')

    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKey)

    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.classList.remove('is-locked')
      startScroll()
    }
  }, [open])

  const go = (event: MouseEvent<HTMLAnchorElement>, href: string) => {
    event.preventDefault()
    setOpen(false)
    window.setTimeout(() => scrollToSection(href), 80)
  }

  return (
    <>
      <header className={`site-header${onLight ? ' is-on-light' : ''}`}>
        <a
          className="site-header__brand"
          href="#top"
          aria-label="DeepCook，回到顶部"
          onClick={(event) => {
            event.preventDefault()
            scrollToTop()
          }}
        >
          <span className="site-header__seal" aria-hidden="true">
            炊
          </span>
          <span className="site-header__word">DEEPCOOK</span>
        </a>

        <nav className="site-nav" aria-label="主导航">
          {navItems.map((item) => (
            <LetterLink
              key={item.href}
              text={item.zh}
              href={item.href}
              onClick={(event) => go(event, item.href)}
            />
          ))}
        </nav>

        <div className="site-header__right">
          <LetterLink
            text="在线使用"
            href="./app/"
            className="header-cta letter-link--en"
            ariaLabel="在线使用 DeepCook"
            arrow
          />
          <button
            className="menu-toggle"
            type="button"
            aria-label="打开菜单"
            aria-expanded={open}
            aria-controls="mobile-menu"
            onClick={() => setOpen(true)}
          >
            <span />
            <span />
          </button>
        </div>
      </header>

      <div
        id="mobile-menu"
        className={`mobile-menu${open ? ' is-open' : ''}`}
        aria-hidden={!open}
      >
        <div className="mobile-menu__top">
          <span className="inline-brand">
            <span className="site-header__seal" aria-hidden="true">
              炊
            </span>
            <span className="site-header__word">DEEPCOOK</span>
          </span>
          <button
            className="mobile-menu__close"
            type="button"
            aria-label="关闭菜单"
            onClick={() => setOpen(false)}
          />
        </div>

        <nav className="mobile-menu__nav" aria-label="移动端导航">
          {navItems.map((item, index) => (
            <a
              key={item.href}
              className="mobile-menu__link"
              href={item.href}
              tabIndex={open ? 0 : -1}
              onClick={(event) => go(event, item.href)}
            >
              <span>{item.zh}</span>
              <span>
                0{index + 1} / {item.en}
              </span>
            </a>
          ))}
          <a
            className="mobile-menu__link"
            href="./app/"
            tabIndex={open ? 0 : -1}
            onClick={() => setOpen(false)}
          >
            <span>在线使用</span>
            <span>05 / OPEN APP</span>
          </a>
        </nav>

        <div className="mobile-menu__foot">
          <div>
            <p className="label">DEEPCOOK 0.5.1</p>
            <p className="label muted">ANDROID 8.0+ · OFFLINE</p>
          </div>
          <a
            className="btn btn--ink btn--small"
            href="./download/DeepCook-0.5.1-preview.apk"
            download
            tabIndex={open ? 0 : -1}
          >
            <span>下载 APK</span>
            <span className="arrow" aria-hidden="true" />
          </a>
        </div>
      </div>
    </>
  )
}
