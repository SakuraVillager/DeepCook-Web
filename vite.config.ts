import react from '@vitejs/plugin-react'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { resolve } from 'node:path'
import { defineConfig, type Plugin } from 'vite'

// Keep the existing extensionless entry and normalize its relative asset URLs.
function redirectOnlineEntry(req: IncomingMessage, res: ServerResponse, next: () => void) {
  if (req.url?.split('?')[0] === '/app') {
    res.writeHead(302, { Location: req.url.replace('/app', '/app/') })
    res.end()
    return
  }
  next()
}

function onlineEntryRedirect(): Plugin {
  return {
    name: 'online-entry-redirect',
    configureServer(server) {
      server.middlewares.use(redirectOnlineEntry)
    },
    configurePreviewServer(server) {
      server.middlewares.use(redirectOnlineEntry)
    },
  }
}

// Relative base so the built site can be dropped into any sub-path.
export default defineConfig({
  base: './',
  appType: 'mpa',
  plugins: [react(), onlineEntryRedirect()],
  build: {
    rollupOptions: {
      input: {
        main: resolve(import.meta.dirname, 'index.html'),
        app: resolve(import.meta.dirname, 'app/index.html'),
      },
    },
  },
})
