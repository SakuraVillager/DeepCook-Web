import type { MouseEvent } from 'react'
import { navItems } from '../data/recipes'
import { scrollToSection, scrollToTop } from '../lib/scroll'

export function Footer() {
  const go = (event: MouseEvent<HTMLAnchorElement>, href: string) => {
    event.preventDefault()
    scrollToSection(href)
  }

  return (
    <footer className="footer" data-theme="dark">
      <div className="container">
        <p className="footer__tagline">Eat well, cook deeper.</p>
        <div className="footer__word" aria-hidden="true">
          DEEPCOOK
        </div>

        <div className="footer__grid">
          <div className="footer__brand">
            <span className="footer__seal" aria-hidden="true">
              炊
            </span>
            <p>
              一款离线优先的中文菜谱 App。把菜谱拆开，把火候讲清楚。
              <br />
              好好吃饭，慢慢生活。
            </p>
          </div>

          <div className="footer__col">
            <h4>探索 / EXPLORE</h4>
            {navItems.map((item) => (
              <a key={item.href} href={item.href} onClick={(event) => go(event, item.href)}>
                {item.zh} · {item.en}
              </a>
            ))}
          </div>

          <div className="footer__col">
            <h4>获取 / GET</h4>
            <a href="./download/DeepCook-0.5.1-preview.apk" download>
              下载 Android 版
            </a>
            <a href="./app/">在线使用</a>
            <a href="#download" onClick={(event) => go(event, '#download')}>
              版本 v0.5.1
            </a>
          </div>

          <div className="footer__col">
            <h4>关于 / ABOUT</h4>
            <a href="#next" onClick={(event) => go(event, '#next')}>
              AI 路线
            </a>
            <span className="footer__plain">内容来源：HowToCook</span>
            <span className="footer__plain">Based Cooking · Unlicense</span>
            <span className="footer__plain">部分图片：FoodiesFeed · CC0</span>
          </div>
        </div>

        <div className="footer__bottom">
          <span>© 2026 DEEPCOOK · 好好吃饭</span>
          <span>菜谱内容来自 HowToCook 与 Based Cooking；照片来自 App 内置素材。</span>
          <button className="footer__top" type="button" onClick={scrollToTop}>
            <span>回到顶部</span>
            <span aria-hidden="true">↑</span>
          </button>
        </div>
      </div>
    </footer>
  )
}
