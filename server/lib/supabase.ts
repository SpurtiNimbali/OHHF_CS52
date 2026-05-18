import { createClient } from '@supabase/supabase-js'
import '../env.js'

const supabaseUrl = (
  process.env.SUPABASE_URL ??
  process.env.VITE_SUPABASE_URL ??
  ''
).trim()

/** Server-only — never expose in Vite client bundles. */
const supabaseSecretKey = (
  process.env.SUPABASE_SECRET_KEY ??
  process.env.SUPABASE_SERVICE_ROLE_KEY ??
  process.env.SUPABASE_KEY ??
  process.env.VITE_SUPABASE_SECRET_KEY ??
  ''
).trim()

export const isServerSupabaseConfigured = Boolean(supabaseUrl && supabaseSecretKey)

if (!isServerSupabaseConfigured) {
  console.warn(
    '[Cardea server] Missing Supabase URL or secret key. Set SUPABASE_URL (or VITE_SUPABASE_URL) and SUPABASE_SECRET_KEY in .env, then run npm run server:dev',
  )
}

export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseSecretKey || 'placeholder-secret-key',
  {
    auth: { autoRefreshToken: false, persistSession: false },
  },
)
