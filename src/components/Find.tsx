import type { CSSProperties } from 'react'
import { RecipeRail } from './RecipeRail'

export function Find() {
  return (
    <section className="section find on-dark" id="features" data-theme="dark">
      <div className="container">
        <div className="sec-head">
          <div className="sec-head__label">
            <span className="heat-tag">中火 · MEDIUM HEAT</span>
            <span className="label">02 / FIND &amp; TONIGHT</span>
          </div>
          <h2 className="h2" data-reveal>
            想到，
            <br />
            就能找到。
          </h2>
          <p
            className="sec-head__note"
            data-reveal
            style={{ '--reveal-delay': '80ms' } as CSSProperties}
          >
            从 494 道里，挑出今晚这一道。
          </p>
        </div>

        <div className="find__grid find__grid--merged">
          <div className="find__intro">
            <div className="find__count" data-reveal>
              494<span>DISHES</span>
            </div>
            <p className="find__copy" data-reveal>
              按菜名、材料、别名、地域或分类搜索，再用分类、用时、难度收窄。
            </p>
          </div>

          <RecipeRail />
        </div>
      </div>
    </section>
  )
}
