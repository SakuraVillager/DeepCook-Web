import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'

// Serve the static online-edition placeholder at /app/ in dev.
// `vite preview` and normal static hosts already resolve the directory index.
function appPlaceholderRoute(): Plugin {
  return {
    name: 'app-placeholder-route',
    configureServer(server) {
      server.middlewares.use((req, _res, next) => {
        const url = req.url?.split('?')[0]
        if (url === '/app' || url === '/app/') {
          req.url = '/app/index.html'
        }
        next()
      })
    },
  }
}

// Relative base so the built site can be dropped into any sub-path.
export default defineConfig({
  base: './',
  appType: 'mpa',
  plugins: [react(), appPlaceholderRoute()],
})
