import type { CSSProperties } from 'react'
import { searchResults } from '../data/recipes'

function SearchIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <circle cx="8.6" cy="8.6" r="5.4" stroke="currentColor" strokeWidth="1.4" />
      <path d="M12.7 12.7 17 17" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  )
}

export function Find() {
  return (
    <section className="section find on-dark" id="features" data-theme="dark">
      <div className="container">
        <div className="sec-head">
          <div className="sec-head__label">
            <span className="heat-tag">中火 · MEDIUM HEAT</span>
            <span className="label">02 / FIND</span>
          </div>
          <h2 className="h2" data-reveal>
            想到，
            <br />
            就能找到。
          </h2>
          <p className="sec-head__note" data-reveal style={{ '--reveal-delay': '80ms' } as CSSProperties}>
            先把整座菜谱库装进口袋，再让搜索和筛选替你缩小范围。
          </p>
        </div>

        <div className="find__grid">
          <div>
            <div className="find__count" data-reveal>
              494<span>DISHES</span>
            </div>
            <p className="find__copy" data-reveal>
              输入菜名、材料、别名、地域或分类，多词一起匹配；再按分类、用时、难度收窄。
              填写过饮食偏好后，DeepCook 会先替你排除忌口，不合适的选择不再浪费你的时间。
            </p>

            <div className="find-features" data-reveal>
              <div className="find-feature">
                <b>搜索范围</b>
                <span>菜名 · 材料 · 别名 · 地域 · 分类</span>
              </div>
              <div className="find-feature">
                <b>输入体验</b>
                <span>250MS 防抖 · 多词全部命中</span>
              </div>
              <div className="find-feature">
                <b>组合筛选</b>
                <span>分类 · 用时 · 难度</span>
              </div>
              <div className="find-feature">
                <b>偏好排除</b>
                <span>过敏 · 忌口 · 饮食方式</span>
              </div>
            </div>
          </div>

          <div className="search-card" data-reveal aria-label="搜索界面示意">
            <span className="search-card__tag">UI 示意</span>

            <div className="search-card__bar">
              <SearchIcon />
              <span className="search-card__query">番茄 鸡蛋</span>
              <span className="search-card__caret" aria-hidden="true" />
              <span className="search-card__hint">250MS</span>
            </div>

            <div className="search-card__chips" aria-hidden="true">
              <span className="chip is-on">全部</span>
              <span className="chip">家常菜</span>
              <span className="chip">30 分钟内</span>
              <span className="chip">难度 1–3</span>
            </div>

            <div className="search-card__results">
              {searchResults.map((item) => (
                <div className="result-row" key={item.title}>
                  <img src={item.cover} alt="" loading="lazy" />
                  <div>
                    <div className="result-row__title">{item.title}</div>
                    <div className="result-row__meta">{item.meta}</div>
                  </div>
                  <div className="result-row__time">{item.time}</div>
                </div>
              ))}
            </div>

            <div className="search-card__foot">
              <span>
                找到 <strong>11</strong> 道菜谱
              </span>
              <span>偏好未填写 · 不排除食材</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
