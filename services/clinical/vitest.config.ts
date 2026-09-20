import { defineConfig } from 'vitest/config'
import { workerVitestConfig } from '../../packages/worker-tooling/vite.mjs'

// HTTP-level tests through the Hono app's `fetch`, no workerd. The test body
// and the @spier/* aliases are packages/worker-tooling's (see vite.mjs there
// for why there is no `fhirclient` alias); `defineConfig` stays here so the
// config is typed against THIS service's Vitest.
export default defineConfig(workerVitestConfig())
