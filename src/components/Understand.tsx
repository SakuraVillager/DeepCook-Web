import type { CSSProperties } from 'react'

export function Understand() {
  return (
    <section className="section understand on-dark" id="understand" data-theme="dark">
      <div className="container">
        <div className="sec-head">
          <div className="sec-head__label">
            <span className="heat-tag">余温 · REST</span>
            <span className="label">04 / UNDERSTAND</span>
          </div>
          <h2 className="h2" data-reveal>
            吃得明白，
            <br />
            才吃得踏实。
          </h2>
          <p className="sec-head__note" data-reveal style={{ '--reveal-delay': '80ms' } as CSSProperties}>
            营养、评分、交流与收藏都留在菜谱下面。不联网，也能把一顿饭记得清清楚楚。
          </p>
        </div>

        <div className="understand__grid">
          <div>
            <p className="body-lg" data-reveal>
              每份营养四列摘要，完整营养表随时展开；评分按 10 分制记录，
              评分分布和厨房交流都留在一道菜下面。
            </p>

            <div className="understand__points" data-reveal>
              <div className="understand__point">
                <span>01</span>
                <div>
                  <b>营养摘要</b>
                  每份热量、脂肪、蛋白质、碳水四列并排，完整表含纤维与钠。
                </div>
              </div>
              <div className="understand__point">
                <span>02</span>
                <div>
                  <b>评分 · 作业 · 评论</b>
                  10 分制评分、分布与本机厨房交流，示例内容明确标注。
                </div>
              </div>
              <div className="understand__point">
                <span>03</span>
                <div>
                  <b>收藏与最近浏览</b>
                  收藏按时间倒序；最近浏览去重，最多保留 50 条。
                </div>
              </div>
            </div>
          </div>

          <div className="understand__cards">
            <div className="nutri" data-reveal>
              <div className="nutri__head">
                <span className="nutri__title">每份营养 · 红烧肉</span>
                <span className="nutri__tag">示例数据</span>
              </div>
              <div className="nutri__grid">
                <div className="nutri__item">
                  <div className="nutri__num">
                    480<small>kcal</small>
                  </div>
                  <div className="nutri__label">热量</div>
                </div>
                <div className="nutri__item">
                  <div className="nutri__num">
                    22<small>g</small>
                  </div>
                  <div className="nutri__label">脂肪</div>
                </div>
                <div className="nutri__item">
                  <div className="nutri__num">
                    26<small>g</small>
                  </div>
                  <div className="nutri__label">蛋白质</div>
                </div>
                <div className="nutri__item">
                  <div className="nutri__num">
                    44<small>g</small>
                  </div>
                  <div className="nutri__label">碳水</div>
                </div>
              </div>
              <div className="nutri__foot">
                完整营养表 · 膳食纤维 3.5g · 钠 650mg
                <span>展开</span>
              </div>
            </div>

            <div className="rating-card" data-reveal style={{ '--reveal-delay': '100ms' } as CSSProperties}>
              <div className="rating-card__top">
                <div>
                  <div className="rating-card__score">
                    7.7<small>/ 10</small>
                  </div>
                  <div className="stars" aria-label="评分示例">
                    ★★★★★★★★☆☆
                  </div>
                </div>
                <div className="rating-card__count">
                  3 条示例评分
                  <br />
                  本机保存
                </div>
              </div>

              <blockquote className="quote">
                “第一次做就成功了，收汁比想象中容易。计时器救我。”
                <cite>小禾 · 示例评论</cite>
              </blockquote>

              <div className="fav-row">
                <span>★ 收藏好菜，慢慢下厨</span>
                <span>最近浏览上限 50 条</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
