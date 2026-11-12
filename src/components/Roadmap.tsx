import type { CSSProperties } from 'react'
import { ChapterLabel } from './ChapterLabel'
import { DesignCanvas } from './DesignCanvas'
import { LetterLink } from './LetterLink'

export function Roadmap() {
  return (
    <section
      className="section chapter canvas-page next on-dark"
      id="next"
      data-theme="dark"
    >
      <DesignCanvas className="container chapter__canvas" label="AI 下厨画布">
        <ChapterLabel
          index="05"
          title="AI IN YOUR KITCHEN"
          heat="备菜 · PREP"
        />
        <div className="chapter-heading next__heading">
          <div>
            <h2 className="h2" data-reveal>
              把 AI 请进厨房。
            </h2>
            <p className="next__promise" data-reveal>
              不是替你做饭， 是让你更懂做饭。
            </p>
          </div>
          <div className="next__status" data-reveal>
            <div className="next__badge" data-reveal>
              AVAILABLE IN APP · 下载体验
            </div>
            <p>
              AI 下厨已在 APP
              中实现。把现有食材和口味告诉它，一起安排今晚这一餐。
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
            <article
              className="next-card"
              data-reveal
              style={{ '--reveal-delay': '80ms' } as CSSProperties}
            >
              <span className="next-card__num">02 / WHY</span>
              <h3>为什么这样做</h3>
              <p>
                解释每一步的火候与顺序：为什么先焯水、为什么要等水开、什么时候该收汁。
                让下一次不看菜谱也做得出来。
              </p>
            </article>
            <article
              className="next-card"
              data-reveal
              style={{ '--reveal-delay': '160ms' } as CSSProperties}
            >
              <span className="next-card__num">03 / TONIGHT</span>
              <h3>今晚吃什么</h3>
              <p>
                结合忌口、口味和可用时间，聊聊今晚的菜单，再看看还缺哪些食材。
              </p>
            </article>
          </div>

          <div className="concept" data-reveal>
            <span className="concept__tag">AI COOKING · APP 内体验</span>
            <div className="concept__side">
              <h4>聊聊今晚这一餐</h4>
              <p>
                从冰箱里的食材开始，把时间、口味和困惑说出来。打开 APP，和 AI
                一起下厨。
              </p>
            </div>
            <div className="concept__chat" aria-label="AI 下厨对话示意">
              <p className="bubble bubble--user">
                冰箱里只剩番茄、鸡蛋和半颗包菜。今晚想吃得清淡一点，只有 20
                分钟。
              </p>
              <p className="bubble bubble--ai">
                先做番茄炒蛋，包菜手撕后大火快炒，两道一起 18 分钟能上桌。
                要少油的话，包菜用不粘锅、中火也能出香气——需要我展开步骤吗？
              </p>
            </div>
          </div>
        </div>

        <LetterLink
          text="下载 APP 体验"
          href="./android/#download"
          className="next__download"
          arrow
        />
      </DesignCanvas>
    </section>
  )
}
