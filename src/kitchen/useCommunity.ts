import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  communityWithSamples,
  emptyCommunity,
  type CommunityRecord,
} from './community'
import { communityUpdatesChannel, readCommunity } from './community-storage'
import { useKitchen } from './context'
import type { Recipe } from './types'
import {
  cachedCloudCommunity,
  cloudPostsWithPhotos,
  isCloudCommunity,
  moreCloudPosts,
  readCloudCommunity,
  type CloudCommunity,
} from './community-api'

export function useCommunity(recipe?: Recipe) {
  const { catalog } = useKitchen()
  const recipeId = recipe?.id
  const shared = isCloudCommunity(recipeId ?? '')
  const [cloud, setCloud] = useState<CloudCommunity | null>(null)
  const [paging, setPaging] = useState(false),
    [pagingError, setPagingError] = useState('')
  const [record, setRecord] = useState<CommunityRecord>(() =>
    emptyCommunity(recipe?.id ?? ''),
  )
  const [loading, setLoading] = useState(true),
    [error, setError] = useState('')
  const generation = useRef(0)
  const reload = useCallback(async () => {
    if (!recipeId) return
    const request = ++generation.current
    setPagingError('')
    setLoading(true)
    try {
      const next = await readCommunity(recipeId)
      if (request === generation.current) {
        setRecord(next)
        setError('')
      }
      if (shared) {
        const cached = await cachedCloudCommunity(recipeId)
        const cachedPosts = cached
          ? await cloudPostsWithPhotos(cached.posts)
          : []
        if (cached && request === generation.current) {
          setCloud({ ...cached, posts: cachedPosts })
          setLoading(false)
        }
        const current = await readCloudCommunity(recipeId)
        const posts = await cloudPostsWithPhotos(current.posts, true)
        if (request === generation.current) setCloud({ ...current, posts })
      }
    } catch (e) {
      if (request === generation.current)
        setError(
          e instanceof Error
            ? e.message
            : '互动记录无法读取，缓存与本地记录已保留。',
        )
    } finally {
      if (request === generation.current) setLoading(false)
    }
  }, [recipeId, shared])
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
  const loadMore = async (submission: boolean) => {
    const kind = submission ? 'submission' : 'comment'
    const cursor = cloud?.cursors[kind]
    if (!recipeId || !cursor || paging) return
    const version = generation.current
    setPaging(true)
    setPagingError('')
    try {
      const next = await moreCloudPosts(recipeId, submission, cursor)
      const posts = await cloudPostsWithPhotos(next.posts, true)
      if (version === generation.current)
        setCloud((current) =>
          current
            ? {
                ...current,
                posts: [
                  ...new Map(
                    [...current.posts, ...posts].map((p) => [p.id, p]),
                  ).values(),
                ],
                cursors: { ...current.cursors, [kind]: next.next },
              }
            : current,
        )
    } catch (e) {
      setPagingError(e instanceof Error ? e.message : '记录读取失败，请重试。')
    } finally {
      setPaging(false)
    }
  }
  const content = useMemo(() => {
    if (!recipe)
      return {
        nutrition: null,
        ownRating: null,
        ratings: [],
        posts: [],
        sampleRatings: 0,
      }
    const base = communityWithSamples(
      shared ? { ...record, ownRating: null } : record,
      recipe,
      catalog,
    )
    if (!shared) return base
    const local = base.posts.map((p) =>
      p.sample ? p : { ...p, localOnly: true },
    )
    return {
      ...base,
      ownRating: cloud?.ownRating ?? null,
      localRating: record.ownRating,
      ratingCounts: cloud?.ratingCounts ?? Array(10).fill(0),
      posts: [...(cloud?.posts ?? []), ...local].sort(
        (a, b) => b.createdAt - a.createdAt || b.id.localeCompare(a.id),
      ),
      postCounts: {
        comment:
          (cloud?.postCounts.comment ?? 0) +
          local.filter((p) => !p.submission).length,
        submission:
          (cloud?.postCounts.submission ?? 0) +
          local.filter((p) => p.submission).length,
      },
    }
  }, [record, recipe, catalog, cloud, shared])
  return {
    content,
    loading,
    error,
    reload,
    shared,
    paging,
    pagingError,
    loadMore,
    hasMore: cloud?.cursors,
  }
}
export type CommunityState = ReturnType<typeof useCommunity>
