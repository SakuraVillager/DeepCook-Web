import { useState } from 'react'
import { useKitchen } from './context'
import { importLocalUser } from './account-api'
import { Flip, Modal } from './ui'

export function AccountCard() {
  const { account: auth, user, notify, guard } = useKitchen()
  const [mode, setMode] = useState<'login' | 'register' | null>(null)
  const [username, setUsername] = useState(''),
    [password, setPassword] = useState(''),
    [confirm, setConfirm] = useState(''),
    [name, setName] = useState('')
  const [merge, setMerge] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('')
  if (!auth.enabled) return null
  const blocked = busy || auth.syncing
  const logout = async () => {
    if (guard.current?.() === false) return
    setBusy(true)
    setError('')
    try {
      await auth.logout()
      notify('已退出账号。')
    } catch (problem) {
      setError(
        problem instanceof Error ? problem.message : '退出失败，请重试。',
      )
    } finally {
      setBusy(false)
    }
  }
  const open = (next: 'login' | 'register') => {
    setMode(next)
    setUsername(auth.account?.username ?? '')
    setPassword('')
    setConfirm('')
    setName(user.profile.name)
    setMerge(next === 'register')
    setError('')
  }
  return (
    <>
      <section className="k-account" aria-label="厨房账号">
        <div>
          <span className="label">YOUR ACCOUNT / 厨房账号</span>
          <h2>{auth.account ? auth.account.name : '把厨房，随身带走。'}</h2>
          <p>
            {auth.syncing
              ? '正在准备账号与同步资料…'
              : auth.account
                ? `@${auth.account.username} · ${auth.expired ? '登录已过期' : '账号已登录'}`
                : '登录后，收藏、菜谱、头像与偏好都会随账号同步。'}
          </p>
        </div>
        <div className="k-account__actions">
          {!auth.account || auth.expired ? (
            <>
              <Flip
                className="btn"
                disabled={!auth.ready || blocked}
                onClick={() => open('login')}
              >
                {auth.expired ? '重新登录 ↗' : '登录 ↗'}
              </Flip>
              {!auth.expired && (
                <Flip
                  disabled={!auth.ready || blocked}
                  onClick={() => open('register')}
                >
                  注册账号 ↗
                </Flip>
              )}
              {auth.account && auth.expired && (
                <Flip disabled={blocked} onClick={logout}>
                  退出登录 ↗
                </Flip>
              )}
            </>
          ) : (
            <>
              <Flip
                disabled={blocked}
                onClick={async () => {
                  setBusy(true)
                  setError('')
                  try {
                    await importLocalUser(auth.account!.id)
                    notify('本机资料已并入账号。')
                  } catch (problem) {
                    setError(
                      problem instanceof Error
                        ? problem.message
                        : '合并失败，本机资料已保留。',
                    )
                  } finally {
                    setBusy(false)
                  }
                }}
              >
                {busy ? '正在同步…' : '合并本机资料 ↗'}
              </Flip>
              <Flip disabled={blocked} onClick={logout}>
                退出登录 ↗
              </Flip>
            </>
          )}
        </div>
        {(error || auth.error) && (
          <p className="k-account__error" role="alert">
            {error || auth.error}
          </p>
        )}
      </section>
      {mode && (
        <Modal
          title={mode === 'register' ? '创建你的厨房账号。' : '欢迎回到厨房。'}
          onClose={() => {
            if (!busy) {
              setMode(null)
              setPassword('')
              setConfirm('')
            }
          }}
        >
          <form
            className="k-form-fields k-account-form"
            onSubmit={async (event) => {
              event.preventDefault()
              setError('')
              if (mode === 'register' && password !== confirm) {
                setError('两次输入的密码不一致。')
                return
              }
              setBusy(true)
              try {
                await auth.authenticate(mode, {
                  username,
                  password,
                  name,
                  merge,
                })
                setMode(null)
                setPassword('')
                setConfirm('')
                notify(mode === 'register' ? '厨房账号已创建。' : '欢迎回来。')
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
                disabled={busy}
                onChange={(event) => setUsername(event.target.value)}
              />
              <small id="account-username-hint">
                3–24 位字母、数字或下划线，不区分大小写。
              </small>
            </label>
            {mode === 'register' && (
              <label>
                账号昵称
                <input
                  maxLength={12}
                  autoComplete="nickname"
                  value={name}
                  disabled={busy}
                  onChange={(event) => setName(event.target.value)}
                />
              </label>
            )}
            <label>
              密码
              <input
                type="password"
                aria-label="密码"
                aria-describedby="account-password-hint"
                required
                minLength={15}
                maxLength={128}
                autoComplete={
                  mode === 'register' ? 'new-password' : 'current-password'
                }
                value={password}
                disabled={busy}
                onChange={(event) => setPassword(event.target.value)}
              />
              <small id="account-password-hint">
                15–128 个字符，可以使用容易记住的长句。
              </small>
            </label>
            {mode === 'register' && (
              <label>
                再次输入密码
                <input
                  type="password"
                  required
                  minLength={15}
                  maxLength={128}
                  autoComplete="new-password"
                  value={confirm}
                  disabled={busy}
                  onChange={(event) => setConfirm(event.target.value)}
                />
              </label>
            )}
            <label className="k-account-merge">
              <input
                type="checkbox"
                checked={merge}
                disabled={busy}
                onChange={(event) => setMerge(event.target.checked)}
              />
              <span>
                将此浏览器的资料、收藏、个人菜谱及已发布的访客互动并入账号。
              </span>
            </label>
            <p className="k-fine">
              目前使用用户名和密码登录，尚未启用邮箱验证与邮件找回密码。
            </p>
            {error && (
              <p className="k-account__error" role="alert">
                {error}
              </p>
            )}
            <div className="k-modal-actions">
              <Flip
                disabled={busy}
                onClick={() => {
                  setMode(null)
                  setPassword('')
                  setConfirm('')
                }}
              >
                取消
              </Flip>
              <button className="btn" type="submit" disabled={busy}>
                {busy
                  ? '正在进入厨房…'
                  : mode === 'register'
                    ? '创建账号'
                    : '登录账号'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </>
  )
}
