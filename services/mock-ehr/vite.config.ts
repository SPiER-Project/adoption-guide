import { defineConfig } from 'vite'
import { workerViteConfig } from '../../packages/worker-tooling/vite.mjs'

// The mock EHR Worker. Shared build body: packages/worker-tooling. The one
// per-service input: `cloudflare:*` modules are provided BY the runtime — the
// Durable Objects import `cloudflare:workers` — so Rollup must leave them
// unresolved rather than fail with "failed to resolve import".
export default defineConfig(workerViteConfig({ external: [/^cloudflare:/] }))
