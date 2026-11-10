import { spawnSync } from 'node:child_process'

// Never send test writes to the public community API.
const npm = process.env.npm_execpath
if (!npm) throw new Error('Run through npm run build:test')
const result = spawnSync(process.execPath, [npm, 'run', 'build'], {
  stdio: 'inherit',
  env: {
    ...process.env,
    VITE_COMMUNITY_API: process.argv.includes('--cloud')
      ? 'http://127.0.0.1:4199/deepcook-api/v1'
      : '',
  },
})
process.exit(result.status ?? 1)
