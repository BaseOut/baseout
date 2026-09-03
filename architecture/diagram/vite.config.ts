import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // Worker static assets are served from ./dist, matching wrangler.jsonc.
  build: { outDir: 'dist', emptyOutDir: true },
})
