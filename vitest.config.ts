import { defineConfig } from 'vitest/config'

// Deliberately not built on `vite.config.ts`: that file describes the library build (lib entry,
// externals), none of which applies to a test run. Specs are pure functions only, so no DOM.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/__tests__/*.spec.ts'],
  },
})
