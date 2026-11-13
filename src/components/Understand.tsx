import nutritionEstimates from '../data/nutrition-estimates.json' with { type: 'json' }
import type { CSSProperties } from 'react'
import { ChapterLabel } from './ChapterLabel'
import { DesignCanvas } from './DesignCanvas'

const preview = Object.entries(nutritionEstimates.recipes).find(
  ([, entry]) => entry.values.basis === 'serving',
)
const nutrition = preview?.[1].values

export function Understand() {
  return (
    <section
      className="section chapter canvas-page understand on-dark"
      id="understand"
      data-theme="dark"
    >
      <DesignCanvas
        className="container chapter__canvas"
        label="营养与评分画布"
      >
        <ChapterLabel index="04" title="UNDERSTAND" heat="余温 · REST" />
        <div className="chapter-heading understand__heading">
          <h2 className="h2" data-reveal>
            吃得明白，
            <br />
            才吃得踏实。
          </h2>
          <p
            className="understand__lead"
            data-reveal
            style={{ '--reveal-delay': '80ms' } as CSSProperties}
          >
            营养、评分、交流与收藏都留在菜谱下面。登录后，让下厨记录在不同设备间继续。
          </p>
        </div>

        <div className="understand__overview">
          <p className="body-lg understand__description" data-reveal>
            每份营养四列摘要，完整营养表随时展开；评分按 10 分制记录，
            评分分布和厨房交流都留在一道菜下面。
          </p>
          <div className="understand__cards">
            <div className="nutri" data-reveal>
              <div className="nutri__head">
                <span className="nutri__title">
                  每份营养 · {preview?.[1].title ?? '菜谱'}
                </span>
                <span className="nutri__tag">大致估算</span>
              </div>
              <div className="nutri__grid">
                <div className="nutri__item">
                  <div className="nutri__num">
                    {nutrition?.calories ?? '—'}
                    <small>kcal</small>
                  </div>
                  <div className="nutri__label">热量</div>
                </div>
                <div className="nutri__item">
                  <div className="nutri__num">
                    {nutrition?.fat ?? '—'}
                    <small>g</small>
                  </div>
                  <div className="nutri__label">脂肪</div>
                </div>
                <div className="nutri__item">
                  <div className="nutri__num">
                    {nutrition?.protein ?? '—'}
                    <small>g</small>
                  </div>
                  <div className="nutri__label">蛋白质</div>
                </div>
                <div className="nutri__item">
                  <div className="nutri__num">
                    {nutrition?.carbs ?? '—'}
                    <small>g</small>
                  </div>
                  <div className="nutri__label">碳水</div>
                </div>
              </div>
              <div className="nutri__foot">
                仅供饮食参考
                <a href={`./app/#/recipe/${preview?.[0] ?? 'braised-pork'}`}>
                  查看菜谱 ↗
                </a>
              </div>
            </div>

            <div
              className="rating-card"
              data-reveal
              style={{ '--reveal-delay': '100ms' } as CSSProperties}
            >
              <div className="rating-card__top">
                <div>
                  <div className="rating-card__score">
                    10<small>分制</small>
                  </div>
                  <div className="stars" aria-label="支持 1 至 10 分评分">
                    ☆☆☆☆☆☆☆☆☆☆
                  </div>
                </div>
                <div className="rating-card__count">
                  评分随时可改
                  <br />
                  云端共享
                </div>
              </div>

              <div className="quote">
                记下这一餐的火候与调味，也晒晒你的成品。
                <a className="quote__link" href="./app/#/recipe/braised-pork">
                  打开菜谱，分享下厨心得 ↗
                </a>
              </div>

              <div className="fav-row">
                <span>★ 收藏好菜，慢慢下厨</span>
                <span>最近浏览上限 50 条</span>
              </div>
            </div>
          </div>
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
                10 分制评分、分布与云端厨房交流；分享心得，也交一份作业。
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
      </DesignCanvas>
    </section>
  )
}
