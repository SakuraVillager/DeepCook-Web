import { createContext, useContext } from 'react'
import type { Recipe, UserData } from './types'
import type { AccountState } from './useAccount'
export type Go = (path: string) => void
export interface KitchenContext {
  catalog: Recipe[]
  user: UserData
  account: AccountState
  ready: boolean
  interactive: boolean
  go: Go
  commit: (transform: (data: UserData) => UserData) => Promise<void>
  notify: (text: string, undo?: () => void) => void
  favorite: (recipe: Recipe) => void
  guard: { current: (() => boolean) | null }
}
export const Kitchen = createContext<KitchenContext | null>(null)
export function useKitchen() {
  const context = useContext(Kitchen)
  if (!context) throw new Error('Kitchen provider missing')
  return context
}
