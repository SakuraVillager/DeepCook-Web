import { BrandMark } from '../components/BrandMark'
import { useEffect, useState } from 'react'
import { useKitchen } from './context'
import { accountPagePath, accountReturnPath } from './account-routes'
import { Empty, Flip } from './ui'

export function AccountPage({
  mode,
  next,
}: {
  mode: 'login' | 'register'
  next: string | null
}) {
  const { account: auth, go, notify } = useKitchen()
  const destination = accountReturnPath(next)
  const registering = mode === 'register'
  const [username, setUsername] = useState(auth.account?.username ?? '')
  const [password, setPassword] = useState(''),
    [confirm, setConfirm] = useState('')
  const [merge, setMerge] = useState(registering),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('')
  const blocked = busy || auth.syncing

  useEffect(() => {
    if (auth.ready && auth.account && !auth.expired && !auth.syncing)
      go(registering ? '/food-profile' : destination)
  }, [auth.ready, auth.account, auth.expired, auth.syncing, destination, go, registering])

  if (!auth.enabled)
    return (
      <Empty title="厨房账号暂时无法使用。" text="先逛逛菜谱，稍后再来。">
        <Flip onClick={() => go(destination)}>返回菜谱 ↗</Flip>
      </Empty>
    )

  return (
    <section
      className={`k-auth${registering ? ' k-auth--register' : ''}`}
      aria-label={registering ? '注册厨房账号' : '登录厨房账号'}
    >
      <div className="k-auth-story">
        <Flip onClick={() => go(destination)}>← 返回</Flip>
        <div className="k-auth-story__heading">
          <span className="label label--zh">YOUR KITCHEN / 随时回来的地方</span>
          <h1>
            {registering ? (
              <>
                把厨房，
                <br />
                随身带走。
              </>
            ) : (
              <>
                欢迎回到，
                <br />
                你的厨房。
              </>
            )}
          </h1>
          <p>
            收藏喜欢的菜，记下拿手的味道。
            <br />
            你的菜谱、口味与下厨手记，
            <br />
            在每次登录时，与你重逢。
          </p>
        </div>
        <div className="k-auth-story__foot">
          <span>
            Good food.
            <br />
            <i>Your own kitchen.</i>
          </span>
          <span className="k-auth-seal" aria-hidden="true">
            <BrandMark />
          </span>
        </div>
      </div>
      <div className="k-auth-panel">
        <nav className="k-auth-tabs" aria-label="账号入口">
          {(['login', 'register'] as const).map((item) => (
            <a
              key={item}
              href={`#${accountPagePath(item, destination)}`}
              aria-current={item === mode ? 'page' : undefined}
              onClick={(event) => {
                event.preventDefault()
                if (!blocked) go(accountPagePath(item, destination))
              }}
              aria-disabled={blocked || undefined}
            >
              {item === 'login' ? '登录' : '注册'}
            </a>
          ))}
        </nav>
        {auth.account && !auth.expired ? (
          <div className="k-auth-progress" role="status">
            <h2>{auth.syncing ? '正在准备你的厨房…' : '正在返回你的厨房…'}</h2>
            <p>把资料收好，马上就来。</p>
          </div>
        ) : (
          <>
            <header className="k-auth-panel__heading">
              <span className="label">
                {registering ? '01 / A NEW CHAPTER' : '02 / WELCOME BACK'}
              </span>
              <h2>{registering ? '创建厨房账号' : '登录厨房账号'}</h2>
            </header>
            <form
              className="k-form-fields k-account-form k-auth-form"
              onSubmit={async (event) => {
                event.preventDefault()
                setError('')
                if (registering && password !== confirm) {
                  setError('两次输入的密码不一致。')
                  return
                }
                setBusy(true)
                try {
                  await auth.authenticate(mode, {
                    username,
                    password,
                    merge,
                  })
                  setPassword('')
                  setConfirm('')
                  notify(registering ? '厨房账号已创建。' : '欢迎回来。')
                } catch (problem) {
                  setError(
                    problem instanceof Error
                      ? problem.message
                      : '暂时无法登录，请重试。',
                  )
                } finally {
                  setBusy(false)
                }
              }}
            >
              <div
                className={`k-auth-fields${registering ? ' is-register' : ''}`}
              >
                <label>
                  用户名
                  <input
                    required
                    aria-label="用户名"
                    aria-describedby="account-username-hint"
                    pattern="[A-Za-z0-9_]{3,24}"
                    minLength={3}
                    maxLength={24}
                    autoCapitalize="none"
                    autoCorrect="off"
                    autoComplete="username"
                    value={username}
                    disabled={blocked}
                    onChange={(event) => setUsername(event.target.value)}
                  />
                </label>
                <label>
                  密码
                  <input
                    type="password"
                    required
                    aria-label="密码"
                    aria-describedby="account-password-hint"
                    minLength={6}
                    maxLength={128}
                    autoComplete={
                      registering ? 'new-password' : 'current-password'
                    }
                    value={password}
                    disabled={blocked}
                    onChange={(event) => setPassword(event.target.value)}
                  />
                </label>
                {registering && (
                  <label>
                    再次输入密码
                    <input
                      type="password"
                      required
                      minLength={6}
                      maxLength={128}
                      autoComplete="new-password"
                      value={confirm}
                      disabled={blocked}
                      onChange={(event) => setConfirm(event.target.value)}
                    />
                  </label>
                )}
              </div>
              <p className="k-auth-field-hints">
                <span id="account-username-hint">
                  用户名：3–24 位字母、数字或下划线。
                </span>
                <span id="account-password-hint">
                  密码：6–128 个字符。
                </span>
              </p>
              <label className="k-account-merge">
                <input
                  type="checkbox"
                  checked={merge}
                  disabled={blocked}
                  onChange={(event) => setMerge(event.target.checked)}
                />
                <span>合并本机资料、收藏、菜谱和已发布互动。</span>
              </label>
              {(error || auth.error) && (
                <p className="k-account__error" role="alert">
                  {error || auth.error}
                </p>
              )}
              <div className="k-auth-actions">
                <button
                  className="btn"
                  type="submit"
                  disabled={blocked || !auth.ready}
                >
                  {blocked
                    ? '正在进入厨房…'
                    : registering
                      ? '创建账号'
                      : '登录账号'}
                </button>
                <Flip disabled={blocked} onClick={() => go(destination)}>
                  先逛逛 ↗
                </Flip>
              </div>
            </form>
          </>
        )}
      </div>
    </section>
  )
}
