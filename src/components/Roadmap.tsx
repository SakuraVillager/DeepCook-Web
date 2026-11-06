import type { CSSProperties } from 'react'
import { ChapterLabel } from './ChapterLabel'
import { DesignCanvas } from './DesignCanvas'

export function Roadmap() {
  return (
    <section className="section chapter canvas-page next on-dark" id="next" data-theme="dark">
      <DesignCanvas className="container chapter__canvas" label="AI 路线画布">
        <ChapterLabel index="05" title="WHAT'S NEXT" heat="备菜 · PREP" />
        <div className="chapter-heading next__heading">
          <div>
            <h2 className="h2" data-reveal>
              把 AI 请进厨房。
            </h2>
            <p className="next__promise" data-reveal>
              不是替你做饭，
              是让你更懂做饭。
            </p>
          </div>
          <div className="next__status" data-reveal>
            <div className="next__badge" data-reveal>
              COMING SOON · 开发中
            </div>
            <p>
              0.5.1 还没有 AI。下面是我们正在设计的方向，不是已经上线的功能。
            </p>
          </div>
        </div>

        <div className="next__body">
          <div className="next__cards">
            <article className="next-card" data-reveal>
              <span className="next-card__num">01 / INGREDIENTS</span>
              <h3>冰箱里有什么</h3>
              <p>
                根据现有食材、口味和用餐人数，生成一份能真正执行的菜谱，
                而不是一串看起来合理的食材清单。
              </p>
            </article>
            <article className="next-card" data-reveal style={{ '--reveal-delay': '80ms' } as CSSProperties}>
              <span className="next-card__num">02 / WHY</span>
              <h3>为什么这样做</h3>
              <p>
                解释每一步的火候与顺序：为什么先焯水、为什么要等水开、什么时候该收汁。
                让下一次不看菜谱也做得出来。
              </p>
            </article>
            <article className="next-card" data-reveal style={{ '--reveal-delay': '160ms' } as CSSProperties}>
              <span className="next-card__num">03 / TONIGHT</span>
              <h3>今晚吃什么</h3>
              <p>
                结合忌口、营养目标和可用时间，给出一周晚餐建议，并顺手列出还缺的食材。
              </p>
            </article>
          </div>

          <div className="concept" data-reveal>
            <span className="concept__tag">CONCEPT PREVIEW · 非实际功能</span>
            <div className="concept__side">
              <h4>一次概念对话</h4>
              <p>
                这是我们对 AI 在 DeepCook 里角色的想象：先理解你的厨房，再给出一条做得到的路。
              </p>
            </div>
            <div className="concept__chat" aria-label="AI 概念对话示意">
              <p className="bubble bubble--user">
                冰箱里只剩番茄、鸡蛋和半颗包菜。今晚想吃得清淡一点，只有 20 分钟。
              </p>
              <p className="bubble bubble--ai">
                先做番茄炒蛋，包菜手撕后大火快炒，两道一起 18 分钟能上桌。
                要少油的话，包菜用不粘锅、中火也能出香气——需要我展开步骤吗？
              </p>
            </div>
          </div>
        </div>

        <p className="label next__disclaimer">
          AI FEATURES ARE NOT AVAILABLE IN 0.5.1 · 仅为设计方向
        </p>
      </DesignCanvas>
    </section>
  )
}
