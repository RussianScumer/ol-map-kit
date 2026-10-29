import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
// Dev server for the interactive playground only; the library build stays in `vite.config.ts`.
export default defineConfig({
  root: fileURLToPath(new URL('./playground', import.meta.url)),
  server: { open: true },
})
