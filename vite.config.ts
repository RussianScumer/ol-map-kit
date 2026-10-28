import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vite'

// Library build only: ESM entry, `ol` and `ol-mapbox-style` stay bare imports so the consumer's single
// copy is used (a bundled second copy breaks `instanceof` and the global `useGeographic()` state).
// https://vite.dev/config/
export default defineConfig({
  build: {
    copyPublicDir: false,
    lib: {
      entry: fileURLToPath(new URL('./src/index.ts', import.meta.url)),
      formats: ['es'],
      fileName: () => 'ol-map-kit.js',
    },
    rollupOptions: {
      external: [/^ol(\/|$)/, /^ol-mapbox-style/],
    },
  },
})
