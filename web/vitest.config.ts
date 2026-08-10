import { defineConfig } from 'vitest/config'

// Almost everything under test is a pure function walking FHIR JSON, so the
// lightweight `node` environment is the default. The one DOM-dependent suite
// (hooks/useScrollToHash.test.tsx) opts into jsdom with a
// `@vitest-environment jsdom` docblock, which keeps jsdom's startup cost off
// the other 34 files.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.{ts,tsx}'],
  },
})
