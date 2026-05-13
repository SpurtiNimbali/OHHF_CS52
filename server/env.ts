import path from 'node:path'
import { config as loadEnv } from 'dotenv'

// Load `.env` then `.env.local` (override) for local dev.
// This file is intended to be imported for its side effects *before*
// other modules that read `process.env` at import time.
const ROOT = process.cwd()
loadEnv({ path: path.join(ROOT, '.env') })
loadEnv({ path: path.join(ROOT, '.env.local'), override: true })

