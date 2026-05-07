import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY environment variables')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

/**
 * Returns `auth.users.id` for the current session, or creates an anonymous
 * session if none exists (same idea as onboarding persistence).
 */
export async function ensureAuthUserId(): Promise<string | null> {
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession()
  if (sessionError) return null
  const existing = sessionData.session?.user?.id
  if (existing) return existing

  const { data: anonData, error: anonError } = await supabase.auth.signInAnonymously()
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
  description: string
  category: string
  link: string
  zipcode: string | null
  city: string | null
}
