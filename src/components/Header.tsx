import { BrandMark } from './BrandMark'
import { useEffect, useState, type MouseEvent } from 'react'
import { LetterLink } from './LetterLink'
import { navItems } from '../data/recipes'
import { appDownload } from '../data/app-download'
import {
  scrollToSection,
  scrollToTop,
  startScroll,
  stopScroll,
} from '../lib/scroll'

type HeaderEdition = {
  items: { href: string; zh: string; en: string }[]
  activeHref: string
  onNavigate: (href: string) => void
  accountHref?: string
  account?: { name: string; avatar?: string }
}

type HeaderPage = {
  items: { href: string; zh: string; en: string }[]
  cta: { text: string; href: string }
}

export function Header({
  edition,
  page,
}: { edition?: HeaderEdition; page?: HeaderPage } = {}) {
  const [open, setOpen] = useState(false)
  const [onLight, setOnLight] = useState(false)
  const online = Boolean(edition)
  const items = edition?.items ?? page?.items ?? navItems
  const accountPath = edition?.account
    ? '/profile'
    : (edition?.accountHref ?? '/login')
  const ctaHref = online ? `#${accountPath}` : (page?.cta.href ?? './app/')
  const ctaText = online
    ? (edition?.account?.name ?? '注册 / 登录')
    : (page?.cta.text ?? '在线使用')
  const linkHref = (href: string) => (online ? `#${href}` : href)

  useEffect(() => {
    if (online || page) return
    let frame = 0

    const update = () => {
      frame = 0
      const probe = 38
      const sections = Array.from(
        document.querySelectorAll<HTMLElement>('[data-theme]'),
      )
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
  }, [online, page])

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
    setOpen(false)
    if (!edition && !href.startsWith('#')) return
    event.preventDefault()
    if (edition) {
      edition.onNavigate(href)
      return
    }
    window.setTimeout(() => scrollToSection(href), 80)
  }

  return (
    <>
      <header
        className={`site-header${online || page ? ' site-header--online' : ''}${online || page || onLight ? ' is-on-light' : ''}`}
      >
        <a
          className="site-header__brand"
          href={online || page ? '../index.html' : '#top'}
          aria-label={
            online || page ? 'DeepCook 官网首页' : 'DeepCook，回到顶部'
          }
          onClick={(event) => {
            if (online || page) return
            event.preventDefault()
            scrollToTop()
          }}
        >
          <span className="site-header__seal" aria-hidden="true">
            <BrandMark />
          </span>
          <span className="site-header__word">DEEPCOOK</span>
        </a>

        <nav className="site-nav" aria-label="主导航">
          {items.map((item) => (
            <LetterLink
              key={item.href}
              text={item.zh}
              href={linkHref(item.href)}
              ariaCurrent={
                edition?.activeHref === item.href ? 'page' : undefined
              }
              onClick={(event) => go(event, item.href)}
            />
          ))}
        </nav>

        <div className="site-header__right">
          {edition?.account ? (
            <a
              className="header-cta header-account"
              href={ctaHref}
              title={edition.account.name}
              aria-label={`进入${edition.account.name}的厨房`}
              onClick={(event) => go(event, accountPath)}
            >
              <span className="header-account__avatar" aria-hidden="true">
                <span>{Array.from(edition.account.name)[0] || <BrandMark />}</span>
                {edition.account.avatar && (
                  <img
                    key={edition.account.avatar}
                    src={edition.account.avatar}
                    alt=""
                    onError={(event) => {
                      event.currentTarget.hidden = true
                    }}
                  />
                )}
              </span>
              <span className="header-account__name">
                {edition.account.name}
              </span>
            </a>
          ) : (
            <LetterLink
              text={ctaText}
              href={ctaHref}
              className="header-cta letter-link--en"
              ariaLabel={
                online ? '注册或登录' : (page?.cta.text ?? '在线使用 DeepCook')
              }
              onClick={
                online
                  ? (event) => go(event, accountPath)
                  : page
                    ? (event) => go(event, ctaHref)
                    : undefined
              }
              arrow
            />
          )}
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
        inert={!open}
      >
        <div className="mobile-menu__top">
          <span className="inline-brand">
            <span className="site-header__seal" aria-hidden="true">
              <BrandMark />
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
          {items.map((item, index) => (
            <a
              key={item.href}
              className="mobile-menu__link"
              href={linkHref(item.href)}
              aria-current={
                edition?.activeHref === item.href ? 'page' : undefined
              }
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
            className={`mobile-menu__link${online ? ' mobile-menu__link--account' : ''}`}
            href={ctaHref}
            tabIndex={open ? 0 : -1}
            onClick={
              online
                ? (event) => go(event, accountPath)
                : (event) => go(event, ctaHref)
            }
          >
            <span>{ctaText}</span>
            <span>{online ? '05 / ACCOUNT' : '05 / OPEN APP'}</span>
          </a>
        </nav>

        <div className="mobile-menu__foot">
          <div>
            <p className="label">
              {online
                ? 'DEEPCOOK / ONLINE EDITION'
                : `DEEPCOOK ${appDownload.version}`}
            </p>
            <p className="label muted">
              {online ? '好好吃饭，慢慢下厨。' : 'ANDROID 8.0+ · OFFLINE'}
            </p>
          </div>
          <a
            className="btn btn--ink btn--small"
            href={appDownload.url}
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
