import { createClient, type SupabaseClient } from '@supabase/supabase-js'

function createBrowserSupabase(): SupabaseClient {
  const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim()
  const supabaseAnonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined)?.trim()

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      'Missing Supabase env vars. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env.local',
    )
  }

  return createClient(supabaseUrl, supabaseAnonKey)
}

let singleton: SupabaseClient | undefined

/** Lazily created so `npm run dev` can start without Supabase vars until auth/data routes run. */
export const supabase: SupabaseClient = new Proxy({} as SupabaseClient, {
  get(_target, prop, receiver) {
    if (!singleton) singleton = createBrowserSupabase()
    const value = Reflect.get(singleton, prop, receiver)
    return typeof value === 'function' ? (value as Function).bind(singleton) : value
  },
})
