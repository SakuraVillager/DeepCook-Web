import { defineConfig } from '@playwright/test'
import base from './playwright.config'

export default defineConfig({
  ...base,
  testIgnore: [],
  testMatch: 'community-cloud.spec.ts',
  webServer: [
    {
      command: 'python3 server/dev.py',
      url: 'http://127.0.0.1:4199/deepcook-api/v1/health',
      reuseExistingServer: false,
    },
    {
      command: 'npm run preview -- --host 127.0.0.1 --port 4173',
      url: 'http://127.0.0.1:4173/app/',
      reuseExistingServer: false,
    },
  ],
})
