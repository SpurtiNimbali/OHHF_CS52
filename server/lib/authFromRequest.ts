import type { Request } from 'express'
import { createClient } from '@supabase/supabase-js'

function supabaseUrl(): string {
  return (process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL ?? '').trim()
}

function supabaseAnonKey(): string {
  return (process.env.VITE_SUPABASE_ANON_KEY ?? '').trim()
}

/** Validates Bearer JWT and returns auth.users id, or null. */
export async function getUserIdFromRequest(req: Request): Promise<string | null> {
  const header = req.headers.authorization
  if (!header?.startsWith('Bearer ')) return null

  const url = supabaseUrl()
  const anonKey = supabaseAnonKey()
  if (!url || !anonKey) return null

  const token = header.slice('Bearer '.length).trim()
  if (!token) return null

  const client = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const { data, error } = await client.auth.getUser(token)
  if (error || !data.user?.id) return null
  return data.user.id
}
