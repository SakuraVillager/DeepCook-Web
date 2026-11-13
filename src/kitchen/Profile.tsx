import { BrandMark } from '../components/BrandMark'
import { useState, useEffect, useRef } from 'react'
import { useKitchen } from './context'
import { DEFAULT_PREFERENCES, publicUrl, assetUrl } from './domain'
import { imageData } from './storage'
import { AVOIDS, LIKES, type Preferences } from './types'
import { Flip, Heading, Modal } from './ui'
import { isCloudCommunity } from './community-api'
import { AccountCard } from './AccountCard'
import { FoodProfileSetup } from './FoodProfileSetup'

function AvatarCrop({
  source,
  onSave,
  onClose,
}: {
  source: string
  onSave: (value: string) => Promise<void>
  onClose: () => void
}) {
  const [zoom, setZoom] = useState(1),
    [x, setX] = useState(50),
    [y, setY] = useState(50),
    [busy, setBusy] = useState(false),
    canvas = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const image = new Image()
    let cancelled = false
    image.onload = () => {
      if (cancelled) return
      const ctx = canvas.current?.getContext('2d')
      if (!ctx) return
      const size = Math.min(image.width, image.height) / zoom
      ctx.clearRect(0, 0, 400, 400)
      ctx.drawImage(
        image,
        ((image.width - size) * x) / 100,
        ((image.height - size) * y) / 100,
        size,
        size,
        0,
        0,
        400,
        400,
      )
    }
    image.src = source
    return () => {
      cancelled = true
    }
  }, [source, zoom, x, y])
  return (
    <Modal
      title="裁出你的厨房头像"
      onClose={() => {
        if (!busy) onClose()
      }}
    >
      <canvas
        ref={canvas}
        width={400}
        height={400}
        className="k-crop"
        aria-label="头像裁剪预览"
      />
      <div className="k-form-fields">
        <label>
          放大
          <input
            type="range"
            min={1}
            max={3}
            step={0.01}
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
          />
        </label>
        <label>
          水平位置
          <input
            type="range"
            min={0}
            max={100}
            value={x}
            onChange={(e) => setX(Number(e.target.value))}
          />
        </label>
        <label>
          垂直位置
          <input
            type="range"
            min={0}
            max={100}
            value={y}
            onChange={(e) => setY(Number(e.target.value))}
          />
        </label>
      </div>
      <div className="k-modal-actions">
        <Flip disabled={busy} onClick={onClose}>
          取消
        </Flip>
        <Flip
          className="btn"
          disabled={busy}
          onClick={async () => {
            if (!canvas.current) return
            setBusy(true)
            try {
              await onSave(canvas.current.toDataURL('image/jpeg', 0.9))
              onClose()
            } catch {
              setBusy(false)
            }
          }}
        >
          {busy ? '正在保存…' : '保存头像'}
        </Flip>
      </div>
    </Modal>
  )
}
export function Profile() {
  const { user, commit, go, ready, notify } = useKitchen(),
    [name, setName] = useState(user.profile.name),
    [photo, setPhoto] = useState(''),
    [importing, setImporting] = useState(false),
    [saving, setSaving] = useState(false)
  useEffect(() => {
    setName(user.profile.name)
  }, [user.profile.name])
  const toggle = async (kind: 'likes' | 'avoids', tag: string) => {
    const on = !user.profile[kind].includes(tag)
    try {
      await commit((d) => {
        const other = kind === 'likes' ? 'avoids' : 'likes'
        return {
          ...d,
          profile: {
            ...d.profile,
            [kind]: on
              ? [...d.profile[kind].filter((t) => t !== tag), tag]
              : d.profile[kind].filter((t) => t !== tag),
            [other]: on
              ? d.profile[other].filter((t) => t !== tag)
              : d.profile[other],
          },
        }
      })
    } catch {
      /* Error is shown by provider. */
    }
  }
  return (
    <>
      <Heading
        index="03"
        en="A KITCHEN OF YOUR OWN"
        title="好好吃饭，从这里开始。"
      />
      <AccountCard />
      <div className="k-profile">
        <section className="k-profile-card">
          <div className="k-profile-card__top">
            <div className="k-avatar">
              {user.profile.avatar ? (
                <img src={assetUrl(user.profile.avatar)} alt="我的头像" />
              ) : (
                <span aria-hidden="true"><BrandMark /></span>
              )}
            </div>
            <div>
              <span className="label">YOUR KITCHEN / 我的厨房</span>
              <h2>{user.profile.name || '我的厨房'}</h2>
              <p>收藏好菜，慢慢下厨。</p>
            </div>
          </div>
          <div className="k-profile-stats">
            {[
              ['收藏', user.favorites.length, '/favorites'],
              ['我的菜谱', user.recipes.length, '/mine'],
              ['最近浏览', user.recent.length, '/recent'],
            ].map(([label, count, path]) => (
              <button key={path} onClick={() => go(String(path))}>
                <b>{count}</b>
                <span>{label} ↗</span>
              </button>
            ))}
          </div>
          <div className="k-profile-card__bottom">
            <Flip className="btn" onClick={() => go('/edit/new')}>
              写一道拿手菜 ↗
            </Flip>
            <Flip onClick={() => go('/settings')}>偏好与设置 ↗</Flip>
          </div>
        </section>
        <section className="k-profile-info">
          <span className="label">A LITTLE ABOUT YOU</span>
          <h2>给厨房，一点你的印记。</h2>
          <form
            onSubmit={async (e) => {
              e.preventDefault()
              if (Array.from(name.trim()).length > 12) {
                notify('昵称最多 12 个字。')
                return
              }
              setSaving(true)
              try {
                await commit((d) => ({
                  ...d,
                  profile: { ...d.profile, name: name.trim() },
                }))
                notify('厨房名字已更新。')
              } catch {
                /* Keep input on failure. */
              } finally {
                setSaving(false)
              }
            }}
          >
            <label>
              厨房昵称
              <div className="k-input-action">
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="我的厨房"
                  aria-describedby="name-hint"
                />
                <button type="submit" disabled={!ready || saving}>
                  {saving ? '保存中…' : '保存 ↗'}
                </button>
              </div>
              <small id="name-hint">最多 12 个字，留空使用「我的厨房」</small>
            </label>
          </form>
          <div className="k-profile-photo-actions">
            <label className="k-upload">
              {importing ? '正在读取…' : '选择头像 ↗'}
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                disabled={!ready || importing}
                onChange={async (e) => {
                  const file = e.target.files?.[0]
                  e.target.value = ''
                  if (!file) return
                  setImporting(true)
                  try {
                    setPhoto(await imageData(file, 1600))
                  } catch (err) {
                    notify(
                      err instanceof Error ? err.message : '图片无法读取。',
                    )
                  } finally {
                    setImporting(false)
                  }
                }}
              />
            </label>
            {user.profile.avatar && (
              <Flip
                onClick={() =>
                  void commit((d) => ({
                    ...d,
                    profile: { ...d.profile, avatar: null },
                  })).catch(() => {})
                }
              >
                移除头像
              </Flip>
            )}
          </div>
        </section>
      </div>
      <section className="k-taste">
        <div className="k-section-title">
          <span className="label">TASTE NOTES</span>
          <h2>喜欢的，与不想吃的。</h2>
          <p>
            先记下常吃偏好；下方的饮食设置会用于首页推荐，搜索仍可浏览全部菜谱。
          </p>
        </div>
        <div>
          {(
            [
              ['likes', '喜欢这些味道', LIKES],
              ['avoids', '这些先不放', AVOIDS],
            ] as const
          ).map(([kind, title, tags]) => (
            <fieldset className="k-tag-field" key={kind}>
              <legend>{title}</legend>
              <div className="k-tags">
                {tags.map((t) => (
                  <button
                    key={t}
                    type="button"
                    disabled={!ready}
                    aria-pressed={user.profile[kind].includes(t)}
                    className={user.profile[kind].includes(t) ? 'active' : ''}
                    onClick={() => void toggle(kind, t)}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </fieldset>
          ))}
        </div>
        <FoodProfileSetup embedded />
      </section>
      {photo && (
        <AvatarCrop
          source={photo}
          onClose={() => setPhoto('')}
          onSave={(avatar) =>
            commit((d) => ({ ...d, profile: { ...d.profile, avatar } }))
          }
        />
      )}
    </>
  )
}
export function Settings() {
  const { user, commit, ready, go, notify, account } = useKitchen(),
    [confirmation, setConfirmation] = useState(''),
    [busy, setBusy] = useState(false)
  const [p, setPreferences] = useState(user.preferences)
  const [changing, setChanging] = useState(false)
  useEffect(() => setPreferences(user.preferences), [user.preferences])
  const change = (patch: Partial<Preferences>) => {
    setPreferences((previous) => ({ ...previous, ...patch }))
    setChanging(true)
    void commit((d) => ({ ...d, preferences: { ...d.preferences, ...patch } }))
      .catch(() => setPreferences(user.preferences))
      .finally(() => setChanging(false))
  }
  return (
    <>
      <div className="k-breadcrumb">
        <Flip onClick={() => go('/profile')}>← 我的厨房</Flip>
      </div>
      <Heading
        index="04"
        en="MAKE YOURSELF AT HOME"
        title="按你的习惯，下厨。"
      />
      <div className="k-settings">
        <section>
          <span className="label">LOOK & FEEL</span>
          <h2>阅读的温度。</h2>
          <div className="k-setting-row">
            <div>
              <h3>明暗模式</h3>
              <p>官网暖米纸与墨黑配色</p>
            </div>
            <select
              aria-label="明暗模式"
              disabled={!ready || changing}
              value={p.theme}
              onChange={(e) =>
                change({ theme: e.target.value as Preferences['theme'] })
              }
            >
              <option value="system">跟随系统</option>
              <option value="light">浅色</option>
              <option value="dark">深色</option>
            </select>
          </div>
          <div className="k-setting-row">
            <div>
              <h3>正文字号</h3>
              <p>用于详情和分步阅读</p>
            </div>
            <select
              aria-label="正文字号"
              disabled={!ready || changing}
              value={p.readingSize}
              onChange={(e) =>
                change({
                  readingSize: e.target.value as Preferences['readingSize'],
                })
              }
            >
              <option value="standard">标准</option>
              <option value="large">大</option>
              <option value="extra">特大</option>
            </select>
          </div>
          <label className="k-setting-row">
            <span>
              <b>显示步骤图片</b>
              <small>详情和分步阅读中的来源配图</small>
            </span>
            <input
              type="checkbox"
              disabled={!ready || changing}
              checked={p.showStepImages}
              onChange={(e) => change({ showStepImages: e.target.checked })}
            />
          </label>
          <label className="k-setting-row">
            <span>
              <b>阅读时保持亮屏</b>
              <small>在支持此能力的浏览器中生效</small>
            </span>
            <input
              type="checkbox"
              disabled={!ready || changing}
              checked={p.keepScreenOn}
              onChange={(e) => change({ keepScreenOn: e.target.checked })}
            />
          </label>
          <p className="k-fine">
            字体与动效尊重系统设置。网页固定使用 DeepCook 品牌色。
          </p>
        </section>
        <section>
          <span className="label">LOCAL RECORDS</span>
          <h2>整理一下厨房。</h2>
          <p className="k-fine">
            {account.account
              ? '昵称、头像、口味、显示与阅读设置、收藏、最近浏览和个人菜谱已随账号同步；本机保留阅读缓存。'
              : '游客资料保存在当前浏览器。注册或登录厨房账号后，可以同步资料、偏好、收藏与个人菜谱。'}
          </p>
          {[
            ['favorites', `清空收藏 · ${user.favorites.length}`],
            ['recent', `清除最近浏览 · ${user.recent.length}`],
            ['preferences', '恢复默认显示与阅读设置'],
          ].map(([key, label]) => (
            <div className="k-setting-row" key={key}>
              <span>{label}</span>
              <Flip
                disabled={!ready || changing}
                onClick={() => setConfirmation(key!)}
              >
                清理 ↗
              </Flip>
            </div>
          ))}
        </section>
        <section>
          <span className="label">CONTENT & CREDITS</span>
          <h2>每份内容，都有来处。</h2>
          <p>
            494 道菜谱：HowToCook 中文原文整理 372 道、Based Cooking 中文译文 22
            道、DeepCook 自编菜谱 100
            道。配方供下厨参考，未提供的参数显示「无」。
          </p>
          <p>
            菜谱附有封面与步骤配图，缺图时显示应用图标。原文、图片和许可信息均保留在来源清单中。
          </p>
          <div className="k-credit-links">
            {[
              ['catalog_sources.json', '内容来源与固定版本'],
              ['photo_sources.json', '图片来源清单'],
              ['THIRD_PARTY_NOTICES.md', '第三方声明'],
              ['HOWTOCOOK-LICENSE.txt', 'HowToCook 许可'],
              ['BASED-COOKING-LICENSE.txt', 'Based Cooking 许可'],
            ].map(([path, label]) => (
              <a
                href={publicUrl(`catalog/${path}`)}
                target="_blank"
                rel="noopener noreferrer"
                key={path}
              >
                {label} ↗
              </a>
            ))}
          </div>
          <p className="k-fine">
            资料补全优先复用内置资料，未命中时仅请求固定版本 HowToCook 原文。
            {isCloudCommunity('braised-pork')
              ? '内置菜谱的评分、评论和作业图文公开保存在服务器。登录后可跨设备管理自己的互动；个人菜谱及其图片只对自己的账号开放。'
              : '评分、评论、作业与附图仅保存在此浏览器，清除站点数据后无法恢复。'}
            当前没有计时、营养计算或 AI 功能。
          </p>
        </section>
      </div>
      {confirmation && (
        <Modal
          title="确认整理这部分记录？"
          onClose={() => {
            if (!busy) setConfirmation('')
          }}
        >
          <p>
            {confirmation === 'preferences'
              ? '将恢复默认显示与阅读设置。'
              : confirmation === 'favorites'
                ? '所有收藏标记会被移除。'
                : '最近浏览记录会被清除。'}
            个人菜谱和头像会保留。
          </p>
          {account.account && (
            <p className="k-fine">这次整理会同步到此账号的其他设备。</p>
          )}
          <div className="k-modal-actions">
            <Flip disabled={busy} onClick={() => setConfirmation('')}>
              先留着
            </Flip>
            <Flip
              className="btn"
              disabled={busy}
              onClick={async () => {
                setBusy(true)
                try {
                  await commit((d) =>
                    confirmation === 'preferences'
                      ? { ...d, preferences: { ...DEFAULT_PREFERENCES } }
                      : { ...d, [confirmation]: [] },
                  )
                  setConfirmation('')
                  notify('厨房整理好了。')
                } catch {
                  /* Provider displays failure. */
                } finally {
                  setBusy(false)
                }
              }}
            >
              {busy ? '正在清理…' : '确认清理'}
            </Flip>
          </div>
        </Modal>
      )}
    </>
  )
}
