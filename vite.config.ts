import react from '@vitejs/plugin-react'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { resolve } from 'node:path'
import { readFileSync } from 'node:fs'
import { defineConfig, type Plugin } from 'vite'
import { appDownload } from './src/data/app-download.ts'

// Keep the existing extensionless entry and normalize its relative asset URLs.
function redirectOnlineEntry(
  req: IncomingMessage,
  res: ServerResponse,
  next: () => void,
) {
  const path = req.url?.split('?')[0]
  if (
    path === `/download/${appDownload.fileName}` ||
    path === '/download/DeepCook-0.5.1-preview.apk'
  ) {
    res.writeHead(302, {
      Location: appDownload.url,
      'Cache-Control': 'no-cache',
    })
    res.end()
    return
  }
  if (path === '/app' || path === '/android') {
    res.writeHead(302, { Location: req.url!.replace(path, `${path}/`) })
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

function offlineKitchen(): Plugin {
  return {
    name: 'offline-kitchen',
    apply: 'build',
    generateBundle(_options, bundle) {
      const assets = Object.keys(bundle)
        .filter((path) => /\.(js|css)$/.test(path))
        .map((path) => `../${path}`)
      const source = readFileSync(
        resolve(import.meta.dirname, 'public/app/sw.js'),
        'utf8',
      ).replace(
        'const APP_ASSETS = []',
        `const APP_ASSETS = ${JSON.stringify(assets)}`,
      )
      this.emitFile({ type: 'asset', fileName: 'app/sw.js', source })
    },
  }
}

function deploymentRedirects(): Plugin {
  return {
    name: 'deployment-redirects',
    apply: 'build',
    generateBundle() {
      this.emitFile({
        type: 'asset',
        fileName: 'edgeone.json',
        source: readFileSync(
          resolve(import.meta.dirname, 'edgeone.json'),
          'utf8',
        ),
      })
    },
  }
}

// Relative base so the built site can be dropped into any sub-path.
export default defineConfig({
  base: './',
  appType: 'mpa',
  plugins: [
    react(),
    onlineEntryRedirect(),
    offlineKitchen(),
    deploymentRedirects(),
  ],
  build: {
    rollupOptions: {
      input: {
        main: resolve(import.meta.dirname, 'index.html'),
        app: resolve(import.meta.dirname, 'app/index.html'),
        android: resolve(import.meta.dirname, 'android/index.html'),
      },
    },
  },
})
