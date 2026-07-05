import { defineConfig } from 'vite'
import { cloudflare } from '@cloudflare/vite-plugin'

// Cloudflare Workers build. The plugin runs the Worker in workerd for `vite dev`
// and produces a wrangler-deployable bundle for `vite build`. Because it is a
// Vite build, the app's `import.meta.glob` catalog + scenario loaders (imported
// from ../../web/src) are transformed and their JSON inlined at build time — no
// filesystem access at runtime.
export default defineConfig({
  plugins: [cloudflare()],
})
