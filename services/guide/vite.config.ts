import { defineConfig } from 'vite'
import { workerViteConfig } from '../../packages/worker-tooling/vite.mjs'

// The Adoption Guide Worker: the guide SPA and the rendered IG over Static
// Assets (served natively by wrangler from ./web-dist, not by this build). The
// build body and the @spier/* aliases are packages/worker-tooling's, shared
// with the other three services; `defineConfig` stays here so the config is
// typed against THIS service's Vite, not the root's.
export default defineConfig(workerViteConfig())
