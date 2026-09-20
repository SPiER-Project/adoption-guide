import { defineConfig } from 'vite'
import { workerViteConfig } from '../../packages/worker-tooling/vite.mjs'

// The clinical Worker: dist-clinical (the two SMART apps) over Static Assets,
// framed by a real EHR. Same shared build body as the other three services
// (packages/worker-tooling); `defineConfig` stays here so the config is typed
// against THIS service's Vite, not the root's.
export default defineConfig(workerViteConfig())
