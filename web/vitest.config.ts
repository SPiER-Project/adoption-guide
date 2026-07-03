import { defineConfig } from 'vitest/config'

// The observation/care-plan mappers under test are pure functions that walk
// FHIR JSON — no DOM is needed, so the lightweight `node` environment is used.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
