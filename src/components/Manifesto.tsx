import type { CSSProperties } from 'react'

export function Manifesto() {
  return (
    <section className="section manifesto" id="manifesto" data-theme="light">
      <div className="container">
        <div className="manifesto__top">
          <div>
            <div className="manifesto__index" aria-hidden="true">
              01
            </div>
            <div style={{ marginTop: 26 }}>
              <span className="heat-tag">文火 · SIMMER</span>
            </div>
          </div>

          <h2 className="manifesto__title" data-reveal>
            菜谱不该只是
            <br />
            一张<span className="mark">说明书</span>。
          </h2>
        </div>

        <div className="manifesto__body">
          <div />

          <div className="manifesto__copy">
            <p data-reveal style={{ '--reveal-delay': '60ms' } as CSSProperties}>
              大多数菜谱只告诉你放多少盐，却不说为什么要等水开、为什么要大火收汁。
              DeepCook 把每一道菜拆开：份量、步骤、观察提示和来源，一步一步讲清楚。
            </p>
            <p data-reveal style={{ '--reveal-delay': '140ms' } as CSSProperties}>
              494 道菜谱随 App 提供，不联网也能查、能做、能收藏。你的口味、忌口和最近做过的菜，
              也只留在你自己的手机里。
            </p>
          </div>

          <aside className="manifesto__aside" data-reveal>
            <strong>KITCHEN NOTE 01</strong>
            会做一道菜，不是背下一张配方，而是看懂它的火候。等水开、把肉煎透、让糖色刚好——
            这些「为什么」，才是菜谱真正该留下的东西。
          </aside>
        </div>

        <div className="stats" data-reveal>
          <div className="stat">
            <div className="stat__num">494</div>
            <div className="stat__label">
              <b>道内置菜谱</b>ALL OFFLINE
            </div>
          </div>
          <div className="stat">
            <div className="stat__num">372</div>
            <div className="stat__label">
              <b>道 HowToCook 中文原文</b>OPEN SOURCE
            </div>
          </div>
          <div className="stat">
            <div className="stat__num">219</div>
            <div className="stat__label">
              <b>张来源配图</b>SOURCED
            </div>
          </div>
          <div className="stat">
            <div className="stat__num">
              100<sup>%</sup>
            </div>
            <div className="stat__label">
              <b>核心功能离线可用</b>NO ACCOUNT
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
