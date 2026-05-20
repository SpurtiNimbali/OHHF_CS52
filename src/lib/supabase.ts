import { createClient, type SupabaseClient } from '@supabase/supabase-js'

function browserSupabaseCredentialsReady(): boolean {
  const u = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim()
  const k = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined)?.trim()
  return Boolean(u && k)
}

function createBrowserSupabase(): SupabaseClient {
  const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim()
  const supabaseAnonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined)?.trim()

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      'Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY in .env.local (needed for glossary, support, cardiologist saves, auth)',
    )
  }

  return createClient(supabaseUrl, supabaseAnonKey)
}

let singleton: SupabaseClient | undefined

function getSingleton(): SupabaseClient {
  if (!singleton) singleton = createBrowserSupabase()
  return singleton
}

/** Lazily created so dev server can bundle without anon key until a route uses Supabase. */
export const supabase: SupabaseClient = new Proxy({} as SupabaseClient, {
  get(_target, prop, receiver) {
    const s = getSingleton()
    const value = Reflect.get(s, prop, receiver)
    return typeof value === 'function' ? (value as Function).bind(s) : value
  },
})

/**
 * Returns `auth.users.id` for the current session, or creates an anonymous
 * session if none exists (same idea as onboarding persistence).
 * Returns null when browser Supabase is not configured.
 */
export async function ensureAuthUserId(): Promise<string | null> {
  if (!browserSupabaseCredentialsReady()) return null

  const client = getSingleton()

  const { data: sessionData, error: sessionError } = await client.auth.getSession()
  if (sessionError) return null
  const existing = sessionData.session?.user?.id
  if (existing) return existing

  const { data: anonData, error: anonError } = await client.auth.signInAnonymously()
  if (anonError || !anonData.user?.id) return null
  return anonData.user.id
}

export type CardiologistQuestion = {
  id: string
  question_text: string
  category: string
}

export type SavedQuestion = {
  id: string
  user_id: string
  question_id: string | null
  custom_text: string | null
}

export type SupportResource = {
  id: string
  name: string
  description: string | null
  category: string | null
  link: string | null
  /** City name or `online`. */
  location: string | null
  /** Null when `location` is online-only. */
  zipcode: string | null
  /** Onboarding age label(s); empty means all ages. */
  age: string | null
}
