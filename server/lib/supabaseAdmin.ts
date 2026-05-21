import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import '../env.js'

let adminClient: SupabaseClient | null = null

function resolveSupabaseUrl(): string {
  const url = (process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL ?? '').trim()
  if (!url) {
    throw new Error(
      'Missing Supabase URL. Set SUPABASE_URL or VITE_SUPABASE_URL in .env.local',
    )
  }
  return url
}

function resolveServiceRoleKey(): string {
  const key = (
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
    process.env.SUPABASE_SECRET_KEY ??
    process.env.SUPABASE_KEY ??
    process.env.VITE_SUPABASE_SECRET_KEY ??
    ''
  ).trim()
  if (!key) {
    throw new Error(
      'Missing Supabase service role key. Set SUPABASE_SERVICE_ROLE_KEY or SUPABASE_SECRET_KEY in .env (Project Settings → API → service_role).',
    )
  }
  return key
}

/** Server-only Supabase client (bypasses RLS). Never expose to the browser. */
export function getSupabaseAdmin(): SupabaseClient {
  if (!adminClient) {
    adminClient = createClient(resolveSupabaseUrl(), resolveServiceRoleKey(), {
      auth: { persistSession: false, autoRefreshToken: false },
    })
  }
  return adminClient
}
