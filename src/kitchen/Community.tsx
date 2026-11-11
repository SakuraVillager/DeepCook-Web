import { useCallback, useEffect, useRef, useState } from 'react'
import {
  ratingSummary,
  isCloudPhoto,
  type CommunityDraft,
  type ComposerKind,
  type KitchenPost,
} from './community'
import {
  addCommunityPost,
  communityDraftKey,
  deleteCommunityPost,
  prepareCommunityPhoto,
  rateRecipe,
  readCommunityDraft,
  readCommunityPhoto,
  saveCommunityDraft,
} from './community-storage'
import { useKitchen } from './context'
import { Flip, Modal } from './ui'
import type { CommunityState } from './useCommunity'
import {
  cloudPhotoUrl,
  deleteCloudPost,
  discardCloudUpload,
  publishPost,
  publishRating,
} from './community-api'

function useBlobUrl(blob: Blob | null) {
  const [url, setUrl] = useState('')
  useEffect(() => {
    if (!blob) {
      setUrl('')
      return
    }
    const next = URL.createObjectURL(blob)
    setUrl(next)
    return () => URL.revokeObjectURL(next)
  }, [blob])
  return url
}
function PostPhoto({ post }: { post: KitchenPost }) {
  const [blob, setBlob] = useState<Blob | null>(null),
    [error, setError] = useState('')
  const url = useBlobUrl(blob)
  useEffect(() => {
    if (!post.photo || isCloudPhoto(post.photo)) return
    let active = true
    void readCommunityPhoto(post.photo)
      .then((photo) => {
        if (active) setBlob(photo)
      })
      .catch((e) => {
        if (active)
          setError(e instanceof Error ? e.message : '照片暂时无法读取。')
      })
    return () => {
      active = false
    }
  }, [post.photo])
  if (isCloudPhoto(post.photo))
    return (
      <div className="k-community-photo">
        <img
          src={cloudPhotoUrl(post.photo)}
          alt="下厨作业成品照片"
          loading="lazy"
        />
      </div>
    )
  return (
    <div className="k-community-photo">
      {url ? (
        <img src={url} alt="我的下厨作业成品照片" />
      ) : (
        <p>{error || '正在读取照片…'}</p>
      )}
    </div>
  )
}

interface CommunityProps {
  recipeId: string
  community: CommunityState
}
export function useRecipeInteractions({ recipeId, community }: CommunityProps) {
  const { notify, ready, interactive, guard } = useKitchen()
  const [draft, setDraft] = useState<CommunityDraft | null>(null)
  const [draftReady, setDraftReady] = useState(false),
    [draftError, setDraftError] = useState('')
  const [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [importing, setImporting] = useState(false)
  const [pendingDelete, setPendingDelete] = useState<KitchenPost | null>(null)
  const [workLimit, setWorkLimit] = useState(5),
    [commentLimit, setCommentLimit] = useState(5)
  const key = useRef(communityDraftKey(recipeId)).current
  const editing = Boolean(draft)
  const preview = useBlobUrl(draft?.photo ?? null)
  const writes = useRef(Promise.resolve()),
    unsaved = useRef(0),
    mounted = useRef(true),
    saving = useRef(false),
    unstored = useRef(false),
    draftVersion = useRef(0),
    restoreVersion = useRef(0)
  const reloadDraft = useCallback(async () => {
    if (!recipeId) return
    const version = ++restoreVersion.current
    try {
      const restored = await readCommunityDraft(key)
      if (mounted.current && version === restoreVersion.current) {
        setDraft(
          restored && restored.kind !== 'rating' && !restored.postId
            ? { ...restored, postId: `post-${crypto.randomUUID()}` }
            : restored,
        )
        setDraftReady(true)
        setDraftError('')
      }
    } catch (e) {
      if (mounted.current && version === restoreVersion.current)
        setDraftError(e instanceof Error ? e.message : '互动草稿无法读取。')
    }
  }, [key, recipeId])
  useEffect(() => {
    mounted.current = true
    void reloadDraft()
    return () => {
      mounted.current = false
    }
  }, [reloadDraft])
  useEffect(() => {
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (unsaved.current || saving.current || unstored.current) {
        event.preventDefault()
        event.returnValue = ''
      }
    }
    window.addEventListener('beforeunload', beforeUnload)
    return () => window.removeEventListener('beforeunload', beforeUnload)
  }, [])
  useEffect(() => {
    if (!editing) return
    const check = () => {
      if (saving.current || unsaved.current || unstored.current) {
        notify('当前操作或草稿尚未保存，请完成后再离开。')
        return false
      }
      return true
    }
    guard.current = check
    return () => {
      if (guard.current === check) guard.current = null
    }
  }, [editing, guard, notify])
  const persist = (next: CommunityDraft | null) => {
    restoreVersion.current++
    const version = ++draftVersion.current
    setDraft(next)
    unsaved.current++
    writes.current = writes.current
      .catch(() => {})
      .then(() => saveCommunityDraft(key, next))
      .then(() => {
        if (version === draftVersion.current) {
          unstored.current = false
          if (mounted.current) setDraftError('')
        }
      })
      .catch((e) => {
        unstored.current = true
        if (mounted.current)
          setDraftError(
            e instanceof Error
              ? e.message
              : '草稿未能自动保存，请在离开前重试。',
          )
      })
      .finally(() => {
        unsaved.current--
      })
  }
  const open = (kind: ComposerKind) => {
    if (busy || importing || !draftReady) return
    setError('')
    persist({
      kind,
      text: '',
      photo: null,
      score: community.content.ownRating ?? community.content.localRating ?? 8,
      postId: `post-${crypto.randomUUID()}`,
    })
  }
  const close = async () => {
    if (busy || importing) return
    setBusy(true)
    saving.current = true
    try {
      await writes.current
      await saveCommunityDraft(key, null)
      if (community.shared && draft?.postId)
        void discardCloudUpload(recipeId, draft.postId).catch(() => {})
      setDraft(null)
      setError('')
      setDraftError('')
      unstored.current = false
    } catch (e) {
      setError(e instanceof Error ? e.message : '暂时无法关闭，请重试。')
    } finally {
      if (mounted.current) setBusy(false)
      saving.current = false
    }
  }
  const submit = async () => {
    if (!draft || busy || importing) return
    setBusy(true)
    saving.current = true
    setError('')
    try {
      await writes.current
      if (community.shared) {
        if (draft.kind === 'rating')
          await publishRating(recipeId, draft.score, key)
        else await publishPost(recipeId, draft, key)
      } else if (draft.kind === 'rating')
        await rateRecipe(recipeId, draft.score, key)
      else
        await addCommunityPost(
          recipeId,
          draft.kind === 'submission',
          draft.text,
          draft.kind === 'submission' ? draft.photo : null,
          key,
        )
      setDraft(null)
      setDraftError('')
      unstored.current = false
      await community.reload()
      notify(
        community.shared
          ? '已发布，其他访客也能看到了。'
          : draft.kind === 'rating'
            ? '评分已保存在当前浏览器。'
            : '这次下厨的记录，保存好了。',
      )
    } catch (e) {
      setError(
        e instanceof Error ? e.message : '保存失败，文字和照片仍已保留。',
      )
    } finally {
      if (mounted.current) setBusy(false)
      saving.current = false
    }
  }
  const summary = ratingSummary(
    community.content.ratings,
    community.content.ratingCounts,
  )
  const enabled =
    ready &&
    draftReady &&
    !community.loading &&
    !community.error &&
    !busy &&
    !importing

  return {
    rating: (
      <section className="k-rating" aria-labelledby="recipe-rating-title">
        <header>
          <h2 id="recipe-rating-title">
            菜谱评分 <span> / 10</span>
          </h2>
          <Flip onClick={() => open('rating')} disabled={!enabled}>
            {community.content.ownRating === null
              ? '评价一下 ↗'
              : `我的评分 ${community.content.ownRating}/10 ↗`}
          </Flip>
        </header>
        {community.loading ? (
          <p className="k-fine" role="status">
            正在读取评分…
          </p>
        ) : (
          <div className="k-rating__body">
            <div className="k-rating__score">
              <b>
                {summary.average === null ? '—' : summary.average.toFixed(1)}
              </b>
              <span>
                {summary.average === null
                  ? '暂无评分'
                  : `${summary.count} 条评分`}
              </span>
            </div>
            <div className="k-rating__distribution">
              {summary.groups.map((group) => (
                <div key={group.name}>
                  <span>{group.name}</span>
                  <div
                    role="meter"
                    aria-label={`${group.name}的评分占比`}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={
                      summary.count
                        ? Math.round((group.count / summary.count) * 100)
                        : 0
                    }
                  >
                    <i
                      style={{
                        width: `${summary.count ? (group.count / summary.count) * 100 : 0}%`,
                      }}
                    />
                  </div>
                  <span>{group.count}</span>
                </div>
              ))}
            </div>
          </div>
        )}
        {(community.error || draftError) && (
          <div className="k-community-error" role="alert">
            <p>{community.error || draftError}</p>
            <Flip
              onClick={() => {
                void community.reload()
                if (!draftReady) void reloadDraft()
                else if (draft) persist(draft)
              }}
            >
              重新读取 ↗
            </Flip>
          </div>
        )}
      </section>
    ),
    section: (
      <section id="community" className="k-detail-section k-community">
        <div className="k-section-title">
          <span className="label">04 / KITCHEN NOTES</span>
          <h2>
            晒一道菜，
            <br />
            留一点心得。
          </h2>
          <p>
            你的下厨记录，保存在这里。
            <br />
            {community.shared ? '与其他下厨的人分享。' : '当前仅限此浏览器。'}
          </p>
        </div>
        <div className="k-community__groups">
          <div className="k-community__intro">
            <span className="label">GOOD FOOD, GOOD NOTES.</span>
            <p>记录这次的火候、成品和一点自己的发现。</p>
            {community.shared && (
              <Flip
                disabled={community.loading}
                onClick={() => void community.reload()}
              >
                刷新交流 ↻
              </Flip>
            )}
          </div>
          {([true, false] as const).map((submission) => {
            const posts = community.content.posts.filter(
                (p) => p.submission === submission,
              ),
              limit = submission ? workLimit : commentLimit
            const kind = submission ? 'submission' : 'comment'
            const total = community.content.postCounts?.[kind] ?? posts.length
            return (
              <section
                className="k-community-card"
                key={String(submission)}
                aria-label={submission ? '下厨作业' : '菜谱评论'}
              >
                <header>
                  <h3>
                    {submission ? '交作业' : '评论'} <span>{total}</span>
                  </h3>
                  <Flip
                    disabled={!enabled}
                    onClick={() => open(submission ? 'submission' : 'comment')}
                  >
                    {submission ? '交作业 ↗' : '写评论 ↗'}
                  </Flip>
                </header>
                {community.loading && (
                  <p className="k-fine" role="status">
                    正在读取下厨记录…
                  </p>
                )}
                {!community.loading && !posts.length && (
                  <p className="k-community-empty">
                    {submission
                      ? '还没有作业，记录这次下厨的成果吧。'
                      : '还没有评论，写下你的想法吧。'}
                  </p>
                )}
                {posts.slice(0, limit).map((post) => (
                  <article
                    className="k-community-post"
                    key={post.id}
                    data-post-id={post.id}
                  >
                    <div className="k-community-avatar" aria-hidden="true">
                      {Array.from(post.author)[0]}
                    </div>
                    <div className="k-community-post__body">
                      <header>
                        <div>
                          <b>{post.author}</b>
                          {post.localOnly && (
                            <span className="k-community-sample">仅本机</span>
                          )}
                          <time
                            dateTime={new Date(post.createdAt).toISOString()}
                          >
                            {new Intl.DateTimeFormat('zh-CN', {
                              year: 'numeric',
                              month: '2-digit',
                              day: '2-digit',
                              hour: '2-digit',
                              minute: '2-digit',
                            }).format(post.createdAt)}
                          </time>
                        </div>
                        {post.mine !== false && (
                          <button
                            className="k-community-delete"
                            disabled={busy}
                            aria-label={`删除这条${post.submission ? '作业' : '评论'}`}
                            onClick={() => {
                              setError('')
                              setPendingDelete(post)
                            }}
                          >
                            删除
                          </button>
                        )}
                      </header>
                      <p>{post.text}</p>
                      {post.photo && <PostPhoto post={post} />}
                      {post.photoPending && (
                        <p className="k-fine">
                          这张旧附图尚未同步，当前仅本机可见；联网后刷新交流会重试。
                        </p>
                      )}
                    </div>
                  </article>
                ))}
                {(posts.length > limit || community.hasMore?.[kind]) && (
                  <Flip
                    disabled={community.paging}
                    onClick={async () => {
                      if (community.hasMore?.[kind])
                        await community.loadMore(submission)
                      submission
                        ? setWorkLimit((n) => n + 5)
                        : setCommentLimit((n) => n + 5)
                    }}
                  >
                    {submission ? '查看更多作业 ↓' : '查看更多评论 ↓'}
                  </Flip>
                )}
              </section>
            )
          })}
          {community.pagingError && (
            <p className="k-community-error" role="alert">
              {community.pagingError}
            </p>
          )}
          <p className="k-fine">
            {community.shared
              ? '评分、评论及作业图文会公开保存到服务器；旧本地记录仍标为“仅本机”。清除站点数据会失去访客身份，已发布图文仍会保留。'
              : '评分、评论和作业仅保存在当前浏览器，不会发布到服务器。清除站点数据会删除个人记录与照片。'}
          </p>
        </div>
      </section>
    ),
    dialogs: (
      <>
        {interactive && draft && (
          <Modal
            title={
              draft.kind === 'rating'
                ? '给这道菜评分'
                : draft.kind === 'submission'
                  ? '交一份作业'
                  : '写评论'
            }
            onClose={() => void close()}
          >
            <form
              className="k-community-form"
              onSubmit={(event) => {
                event.preventDefault()
                void submit()
              }}
            >
              {draft.kind === 'rating' ? (
                <>
                  <p className="k-community-form__score">
                    <b>{draft.score}</b>
                    <span>/ 10</span>
                  </p>
                  <label>
                    我的评分
                    <input
                      type="range"
                      min={1}
                      max={10}
                      step={1}
                      value={draft.score}
                      disabled={busy}
                      onChange={(event) =>
                        persist({ ...draft, score: Number(event.target.value) })
                      }
                    />
                  </label>
                  <p className="k-fine">
                    每道菜只保留一条自己的评分，再次保存会覆盖原评分。
                    {community.shared && '评分会公开保存。'}
                  </p>
                </>
              ) : (
                <>
                  <label>
                    {draft.kind === 'submission' ? '下厨心得' : '评论内容'}
                    <textarea
                      required
                      rows={5}
                      maxLength={2000}
                      value={draft.text}
                      disabled={busy || importing}
                      onChange={(event) =>
                        persist({ ...draft, text: event.target.value })
                      }
                    />
                  </label>
                  {community.shared && (
                    <p className="k-fine">
                      {draft.kind === 'submission'
                        ? '作业文字和附图会公开保存，其他访客和其他设备也能查看。'
                        : '评论会公开保存，其他访客也能查看。'}
                    </p>
                  )}
                  <p className="k-community-counter">
                    {draft.text.length}/2000
                  </p>
                  {draft.kind === 'submission' && (
                    <div className="k-community-upload">
                      {preview && <img src={preview} alt="作业照片预览" />}
                      <label className="k-upload">
                        {importing
                          ? '正在处理照片…'
                          : draft.photo
                            ? '更换成品照片 ↗'
                            : '选择成品照片（可选） ↗'}
                        <input
                          type="file"
                          accept="image/jpeg,image/png,image/webp"
                          disabled={busy || importing}
                          onChange={async (event) => {
                            const file = event.target.files?.[0]
                            event.target.value = ''
                            if (!file) return
                            setImporting(true)
                            saving.current = true
                            setError('')
                            try {
                              const photo = await prepareCommunityPhoto(file)
                              if (mounted.current) persist({ ...draft, photo })
                            } catch (e) {
                              if (mounted.current)
                                setError(
                                  e instanceof Error
                                    ? e.message
                                    : '照片无法读取，请重试。',
                                )
                            } finally {
                              if (mounted.current) setImporting(false)
                              saving.current = false
                            }
                          }}
                        />
                      </label>
                      {draft.photo && (
                        <Flip
                          disabled={busy || importing}
                          onClick={() => persist({ ...draft, photo: null })}
                        >
                          移除照片
                        </Flip>
                      )}
                      <p className="k-fine">
                        照片会按 App 的 4:3 比例压缩，输出 1200×900，单张不超过
                        1 MB。
                        {community.shared
                          ? '发布后与作业一起保存到云端。'
                          : '仅保存在此浏览器。'}
                      </p>
                    </div>
                  )}
                </>
              )}
              {(error || draftError) && (
                <p className="k-community-error" role="alert">
                  {error || draftError}
                </p>
              )}
              <div className="k-modal-actions">
                <Flip disabled={busy || importing} onClick={() => void close()}>
                  取消
                </Flip>
                <button
                  type="submit"
                  className="btn"
                  disabled={
                    busy ||
                    importing ||
                    (draft.kind !== 'rating' && !draft.text.trim())
                  }
                >
                  {busy
                    ? '正在保存…'
                    : draft.kind === 'rating'
                      ? community.shared
                        ? '发布评分'
                        : '保存评分'
                      : draft.kind === 'submission'
                        ? community.shared
                          ? '发布作业'
                          : '保存作业'
                        : community.shared
                          ? '发布评论'
                          : '保存评论'}
                </button>
              </div>
            </form>
          </Modal>
        )}
        {pendingDelete && (
          <Modal
            title={
              pendingDelete.submission ? '删除这条作业？' : '删除这条评论？'
            }
            onClose={() => {
              if (!busy) setPendingDelete(null)
            }}
          >
            <p>这条内容和附图会一并删除，菜谱和收藏会保留。</p>
            {error && (
              <p className="k-community-error" role="alert">
                {error}
              </p>
            )}
            <div className="k-modal-actions">
              <Flip disabled={busy} onClick={() => setPendingDelete(null)}>
                取消
              </Flip>
              <Flip
                className="btn"
                disabled={busy}
                onClick={async () => {
                  setBusy(true)
                  saving.current = true
                  try {
                    if (pendingDelete.cloud)
                      await deleteCloudPost(recipeId, pendingDelete.id)
                    else await deleteCommunityPost(recipeId, pendingDelete.id)
                    setPendingDelete(null)
                    await community.reload()
                    notify('已删除这条下厨记录及附图。')
                  } catch (e) {
                    setError(
                      e instanceof Error ? e.message : '删除失败，请重试。',
                    )
                  } finally {
                    setBusy(false)
                    saving.current = false
                  }
                }}
              >
                {busy ? '正在删除…' : '确认删除'}
              </Flip>
            </div>
          </Modal>
        )}
      </>
    ),
  }
}
