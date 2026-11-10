import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  communityWithSamples,
  emptyCommunity,
  type CommunityRecord,
} from './community'
import { communityUpdatesChannel, readCommunity } from './community-storage'
import { useKitchen } from './context'
import type { Recipe } from './types'

export function useCommunity(recipe?: Recipe) {
  const { catalog } = useKitchen()
  const recipeId = recipe?.id
  const [record, setRecord] = useState<CommunityRecord>(() =>
    emptyCommunity(recipe?.id ?? ''),
  )
  const [loading, setLoading] = useState(true),
    [error, setError] = useState('')
  const generation = useRef(0)
  const reload = useCallback(async () => {
    if (!recipeId) return
    const request = ++generation.current
    setLoading(true)
    try {
      const next = await readCommunity(recipeId)
      if (request === generation.current) {
        setRecord(next)
        setError('')
      }
    } catch (e) {
      if (request === generation.current)
        setError(
          e instanceof Error ? e.message : '互动记录无法读取，原数据已保留。',
        )
    } finally {
      if (request === generation.current) setLoading(false)
    }
  }, [recipeId])
  useEffect(() => {
    void reload()
    return () => {
      generation.current++
    }
  }, [reload])
  useEffect(() => {
    if (!recipeId) return
    const channel =
      'BroadcastChannel' in window
        ? new BroadcastChannel(communityUpdatesChannel)
        : null
    if (channel)
      channel.onmessage = (event) => {
        if (event.data === recipeId) void reload()
      }
    const visible = () => {
      if (document.visibilityState === 'visible') void reload()
    }
    document.addEventListener('visibilitychange', visible)
    return () => {
      channel?.close()
      document.removeEventListener('visibilitychange', visible)
    }
  }, [recipeId, reload])
  const content = useMemo(
    () =>
      recipe
        ? communityWithSamples(record, recipe, catalog)
        : { ownRating: null, ratings: [], posts: [], sampleRatings: 0 },
    [record, recipe, catalog],
  )
  return { content, loading, error, reload }
}
export type CommunityState = ReturnType<typeof useCommunity>
