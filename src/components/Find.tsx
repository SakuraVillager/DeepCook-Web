import { RecipeRail } from './RecipeRail'
import { ChapterLabel } from './ChapterLabel'
import { DesignCanvas } from './DesignCanvas'

export function Find() {
  return (
    <section className="section chapter canvas-page find on-dark" id="features" data-theme="dark">
      <DesignCanvas className="container chapter__canvas" label="找菜与精选菜谱画布">
        <ChapterLabel index="02" title="FIND & TONIGHT" heat="中火 · MEDIUM HEAT" />
        <div className="find__heading chapter-heading">
          <h2 className="h2" data-reveal>
            想到，
            <br />
            就能找到。
          </h2>
          <div className="find__intro">
            <div className="find__collection" data-reveal>
              <div className="find__count">494<span>DISHES</span></div>
              <p>从 494 道里，<br />挑出今晚这一道。</p>
            </div>
            <p className="find__copy" data-reveal>
              按菜名、材料、别名、地域或分类搜索，再用分类、用时、难度收窄。
            </p>
          </div>
        </div>
        <RecipeRail />
      </DesignCanvas>
    </section>
  )
}
