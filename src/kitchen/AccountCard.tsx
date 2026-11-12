import { useState } from 'react'
import { useKitchen } from './context'
import { importLocalUser } from './account-api'
import { Flip } from './ui'
import { accountPagePath } from './account-routes'

export function AccountCard() {
  const { account: auth, notify, guard, go } = useKitchen()
  const [busy, setBusy] = useState(false),
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
                onClick={() => go(accountPagePath('login'))}
              >
                {auth.expired ? '重新登录 ↗' : '登录 ↗'}
              </Flip>
              {!auth.expired && (
                <Flip
                  disabled={!auth.ready || blocked}
                  onClick={() => go(accountPagePath('register'))}
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
    </>
  )
}
