import { defineConfig } from 'vite'

// Relative base so the built assets resolve correctly regardless of the
// path the site ends up served from (root domain, subpath, or a sandboxed
// preview origin like an Artifact).
export default defineConfig({
  base: './',
})
