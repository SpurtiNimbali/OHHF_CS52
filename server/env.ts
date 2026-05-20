import path from 'node:path'
import { config as loadEnv } from 'dotenv'

// Load `.env` then `.env.local` then `env.local` (later overrides earlier).
// Also load `env.local` when it exists without the leading dot.
// Import for side effects *before* modules read `process.env` at load time.
const ROOT = process.cwd()
loadEnv({ path: path.join(ROOT, '.env') })
loadEnv({ path: path.join(ROOT, '.env.local'), override: true })
loadEnv({ path: path.join(ROOT, 'env.local'), override: true })

