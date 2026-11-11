import { useCallback, useEffect, useState } from 'react'
import {
  ACCOUNT_EVENT,
  accountHint,
  apiRequest,
  endpoint,
  saveAccountHint,
  type Account,
} from './api'
import { importLocalUser } from './account-api'

export function useAccount() {
  const [account, setAccount] = useState<Account | null>(accountHint),
    [ready, setReady] = useState(!endpoint),
    [expired, setExpired] = useState(false),
    [syncing, setSyncing] = useState(false),
    [error, setError] = useState('')
  const refresh = useCallback(async () => {
    if (!endpoint) {
      setReady(true)
      return
    }
    try {
      const result = await apiRequest('/auth/session', 'GET', undefined, false)
      saveAccountHint(result.account)
      setAccount(result.account)
      setExpired(false)
      setError('')
    } catch (problem) {
      setError(
        problem instanceof Error ? problem.message : '账号暂时无法读取。',
      )
    } finally {
      setReady(true)
    }
  }, [])
  useEffect(() => {
    void refresh()
  }, [refresh])
  useEffect(() => {
    const update = () => setAccount(accountHint())
    const expire = () => {
      setExpired(true)
      setError('登录已过期，请重新登录。')
    }
    const storage = (event: StorageEvent) => {
      if (event.key === 'deepcook-account-v1') {
        update()
        void refresh()
      }
    }
    window.addEventListener(ACCOUNT_EVENT, update)
    window.addEventListener('storage', storage)
    window.addEventListener('deepcook-session-expired', expire)
    return () => {
      window.removeEventListener(ACCOUNT_EVENT, update)
      window.removeEventListener('storage', storage)
      window.removeEventListener('deepcook-session-expired', expire)
    }
  }, [refresh])
  const authenticate = async (
    mode: 'login' | 'register',
    values: {
      username: string
      password: string
      name: string
      merge: boolean
    },
  ) => {
    setSyncing(true)
    try {
      const result = await apiRequest(
        `/auth/${mode}`,
        'POST',
        {
          username: values.username,
          password: values.password,
          name: values.name,
          claimGuest: values.merge,
        },
        false,
      )
      const confirmed = await apiRequest(
        '/auth/session',
        'GET',
        undefined,
        false,
      )
      if (confirmed.account?.id !== result.account?.id)
        throw new Error(
          '此浏览器未能保存登录状态，请在 deepcook.jijiz.cn 正式站点重试。',
        )
      saveAccountHint(result.account)
      setAccount(result.account)
      setExpired(false)
      setError('')
      if (values.merge) {
        try {
          await importLocalUser(result.account.id)
        } catch {
          setError(
            '账号已登录，但本机资料尚未全部并入。请点击“合并本机资料”重试。',
          )
        }
      }
    } finally {
      setSyncing(false)
    }
  }
  const logout = async () => {
    await apiRequest('/auth/logout', 'POST')
    saveAccountHint(null)
    setAccount(null)
    setExpired(false)
    setError('')
  }
  return {
    account,
    ready,
    expired,
    syncing,
    error,
    enabled: Boolean(endpoint),
    refresh,
    authenticate,
    logout,
  }
}
export type AccountState = ReturnType<typeof useAccount>
