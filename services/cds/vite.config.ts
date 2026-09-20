import { defineConfig } from 'vite'
import { workerViteConfig } from '../../packages/worker-tooling/vite.mjs'

// The CDS Hooks Worker: JSON only, no Static Assets. It imports the catalog,
// the mappers and the demo population from ../../packages, which is why it is
// a Vite build at all (the fixtures' `import.meta.glob` loaders inline at
// build time). Shared build body: packages/worker-tooling.
export default defineConfig(workerViteConfig())
