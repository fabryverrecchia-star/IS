import { defineConfig } from 'vite'
import { resolve } from 'path'

// Relative base so the built assets resolve correctly regardless of the
// path the site ends up served from (root domain, subpath, or a sandboxed
// preview origin like an Artifact).
export default defineConfig({
  base: './',
  build: {
    rollupOptions: {
      // admin.html is the content dashboard (see its own file for the
      // passcode gate) — a second, separate entry so it ships as its own
      // page/bundle rather than being reachable through the main app.
      input: {
        main: resolve(import.meta.dirname, 'index.html'),
        admin: resolve(import.meta.dirname, 'admin.html'),
      },
    },
  },
})
