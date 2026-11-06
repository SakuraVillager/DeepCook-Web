import { useEffect, useRef, useState } from 'react'
import { useKitchen } from './context'
import { visible } from './domain'
import type { Recipe } from './types'
import { Empty, Flip, Modal, Photo } from './ui'

export function Reader({
  recipe,
  stepId,
}: {
  recipe?: Recipe
  stepId?: string
}) {
  const { user, go, notify } = useKitchen()
  const [directory, setDirectory] = useState(false)
  const index = Math.max(
    0,
    recipe?.steps.findIndex((s) => s.id === stepId) ?? 0,
  )
  const step = recipe?.steps[index]
  const content = useRef<HTMLDivElement>(null)
  const copy = useRef<HTMLElement>(null)

  useEffect(() => {
    content.current?.scrollTo(0, 0)
    copy.current?.scrollTo(0, 0)
  }, [stepId])

  useEffect(() => {
    if (!user.preferences.keepScreenOn) return
    let lock: WakeLockSentinel | undefined,
      closed = false
    const acquire = async () => {
      if (document.visibilityState !== 'visible') return
      try {
        const next = await navigator.wakeLock.request('screen')
        if (closed) await next.release()
        else lock = next
      } catch {
        if (!closed) notify('当前浏览器无法保持屏幕常亮，阅读仍可继续。')
      }
    }
    if ('wakeLock' in navigator) void acquire()
    else notify('当前浏览器不支持保持屏幕常亮。')
    const onVisibility = () => {
      if (!lock || lock.released) void acquire()
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      closed = true
      void lock?.release()
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [user.preferences.keepScreenOn, notify])

  if (!recipe || !step)
    return (
      <Empty title="没有找到阅读内容。">
        <Flip onClick={() => go('/discover')}>回到找菜 ↗</Flip>
      </Empty>
    )
  const move = (n: number) =>
    go(
      `/read/${encodeURIComponent(recipe.id)}/${encodeURIComponent(recipe.steps[n]!.id)}`,
    )
  const hasImage = Boolean(user.preferences.showStepImages && step.image)
  const stepNumber = String(index + 1).padStart(2, '0')
  const total = String(recipe.steps.length).padStart(2, '0')

  return (
    <div className={`k-reader k-reading-${user.preferences.readingSize}`}>
      <header className="k-reader__header">
        <Flip
          onClick={() => {
            go(`/recipe/${encodeURIComponent(recipe.id)}`)
            setTimeout(
              () =>
                document
                  .getElementById(`step-${step.id}`)
                  ?.scrollIntoView({ block: 'center' }),
              80,
            )
          }}
        >
          ← 返回菜谱
        </Flip>
        <div className="k-reader__recipe">
          <span className="label">DEEPCOOK / READER MODE</span>
          <span>{recipe.title}</span>
        </div>
        <Flip onClick={() => setDirectory(true)}>步骤目录 ≡</Flip>
      </header>

      <div
        className="k-reader__progress"
        role="progressbar"
        aria-label="阅读进度"
        aria-valuemin={1}
        aria-valuemax={recipe.steps.length}
        aria-valuenow={index + 1}
      >
        <i style={{ width: `${((index + 1) / recipe.steps.length) * 100}%` }} />
      </div>

      <div className="k-reader__content" ref={content}>
        <div
          className={`k-reader__stage ${hasImage ? 'k-reader__stage--photo' : 'k-reader__stage--text'}`}
          key={step.id}
        >
          <article
            className="k-reader__copy"
            ref={copy}
            tabIndex={0}
            aria-label="当前步骤正文"
          >
            <div className="k-reader__step-heading">
              <span className="k-reader__number" aria-hidden="true">
                {stepNumber}
              </span>
              <div>
                <span className="label">
                  THE METHOD / STEP {stepNumber} OF {total}
                </span>
                <h1>{step.title}</h1>
              </div>
            </div>
            <p className="k-reader__instruction">{step.text}</p>
            {visible(step.cue) && (
              <aside className="k-observation">
                <span className="label">A LITTLE DETAIL</span>
                <b>观察提示</b>
                <p>{step.cue}</p>
              </aside>
            )}
          </article>

          {hasImage && (
            <aside className="k-reader__companion" aria-label="步骤配图">
              <figure className="k-reader__visual">
                <Photo
                  path={step.image}
                  alt={`${recipe.title}，${step.title}`}
                  eager
                />
                <figcaption>
                  <span className="k-reader__visual-caption">
                    A little care. A better meal.
                  </span>
                  <span className="label">第 {index + 1} 步 · 步骤配图</span>
                </figcaption>
              </figure>
            </aside>
          )}
        </div>
      </div>

      <footer className="k-reader__footer">
        <Flip disabled={index === 0} onClick={() => move(index - 1)}>
          ← 上一步
        </Flip>
        <div className="k-reader__position">
          <span>
            <b>{stepNumber}</b>
            <span>/ {total}</span>
          </span>
          <span className="label">一步一步，不慌不忙。</span>
        </div>
        <Flip
          className="btn"
          onClick={() =>
            index === recipe.steps.length - 1
              ? go(`/recipe/${encodeURIComponent(recipe.id)}`)
              : move(index + 1)
          }
        >
          {index === recipe.steps.length - 1 ? '返回菜谱 ↗' : '下一步 →'}
        </Flip>
      </footer>

      {directory && (
        <Modal title="步骤目录" onClose={() => setDirectory(false)}>
          <ol className="k-directory">
            {recipe.steps.map((s, n) => (
              <li key={s.id}>
                <button
                  aria-current={n === index ? 'step' : undefined}
                  onClick={() => {
                    move(n)
                    setDirectory(false)
                  }}
                >
                  <span>{String(n + 1).padStart(2, '0')}</span>
                  {s.title}
                </button>
              </li>
            ))}
          </ol>
        </Modal>
      )}
    </div>
  )
}
