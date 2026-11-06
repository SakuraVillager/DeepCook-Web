import '@fontsource-variable/archivo/wght.css'
import '@fontsource/instrument-serif/400-italic.css'
import '@fontsource-variable/noto-sans-sc/wght.css'
import './styles/tokens.css'
import './styles/base.css'
import './styles/footer.css'
import './styles/cursor.css'
import './styles/kitchen.css'
import './styles/recipe.css'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import OnlineEdition from './OnlineEdition'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <OnlineEdition />
  </StrictMode>,
)

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    void navigator.serviceWorker
      .register(new URL('sw.js', document.baseURI).href, {
        scope: new URL('./', document.baseURI).pathname,
      })
      .then(async () => {
        const registration = await navigator.serviceWorker.ready
        await document.fonts.ready
        const urls = performance
          .getEntriesByType('resource')
          .map((e) => e.name)
          .filter(
            (url) =>
              new URL(url).origin === location.origin &&
              /\.(js|css|woff2?)(\?|$)/.test(url),
          )
        registration.active?.postMessage({ type: 'CACHE_SHELL', urls })
      })
      .catch(() => {
        /* Browsing remains available without offline storage. */
      })
  })
}
