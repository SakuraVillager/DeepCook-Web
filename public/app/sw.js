const SHELL = 'deepcook-shell-v1'
const IMAGES = 'deepcook-images-v1'
const root = new URL('../', self.registration.scope)
// The production build replaces this list with fingerprinted JS and CSS paths.
const APP_ASSETS = []
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(SHELL)
      .then((cache) =>
        cache.addAll([
          self.registration.scope,
          new URL('catalog/recipes.json', root).href,
          new URL('catalog/howtocook_index.json', root).href,
          ...APP_ASSETS.map(
            (path) => new URL(path, self.registration.scope).href,
          ),
        ]),
      ),
  )
  self.skipWaiting()
})
self.addEventListener('activate', (event) =>
  event.waitUntil(self.clients.claim()),
)
self.addEventListener('message', (event) => {
  if (event.data?.type !== 'CACHE_SHELL' || !Array.isArray(event.data.urls))
    return
  event.waitUntil(
    caches.open(SHELL).then((cache) =>
      Promise.allSettled(
        event.data.urls
          .filter((url) => {
            const parsed = new URL(url)
            return (
              parsed.origin === root.origin &&
              parsed.pathname.startsWith(root.pathname) &&
              /\.(js|css|woff2?)$/.test(parsed.pathname)
            )
          })
          .map((url) => cache.add(url)),
      ),
    ),
  )
})
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url)
  if (
    event.request.method !== 'GET' ||
    url.pathname.includes('/deepcook-api/') ||
    url.origin !== root.origin ||
    !url.pathname.startsWith(root.pathname)
  )
    return
  event.respondWith(
    (async () => {
      const image = /\.(jpg|jpeg|png|webp)$/.test(url.pathname)
      let cache
      try {
        cache = await caches.open(image ? IMAGES : SHELL)
      } catch {
        return fetch(event.request)
      }
      if (image || /\/assets\//.test(url.pathname)) {
        const cached = await cache.match(event.request, { ignoreVary: true })
        if (cached) return cached
      }
      try {
        const response = await fetch(event.request)
        if (response.ok) {
          try {
            await cache.put(event.request, response.clone())
            if (image) {
              const keys = await cache.keys()
              for (const key of keys.slice(0, Math.max(0, keys.length - 160)))
                await cache.delete(key)
            }
          } catch {
            /* A cache quota error must not discard a valid network response. */
          }
        }
        return response
      } catch {
        const cached = await cache.match(event.request, { ignoreVary: true })
        if (cached) return cached
        if (event.request.mode === 'navigate') {
          const shell = await cache.match(self.registration.scope, {
            ignoreVary: true,
          })
          if (shell) return shell
        }
        return new Response('Offline', { status: 503 })
      }
    })(),
  )
})
