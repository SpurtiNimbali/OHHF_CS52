import { existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { config as loadDotenvEnv } from 'dotenv'

import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'

// Pre-merge env files into process.env before Vite resolves `import.meta.env`.
// Matches server/env.ts (.env → .env.local → env.local). `env.local` has no dot.
const __dirname = path.dirname(fileURLToPath(import.meta.url))
function mergeEnv(rel: string) {
  const p = path.join(__dirname, rel)
  if (!existsSync(p)) return
  loadDotenvEnv({ path: p, override: true })
}
mergeEnv('.env')
mergeEnv('.env.local')
mergeEnv('env.local')

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      '/api': { target: 'http://localhost:3001', changeOrigin: true },
    },
  },
})
