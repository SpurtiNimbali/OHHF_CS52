import { createClient } from '@supabase/supabase-js'

const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim() ?? ''
const supabaseAnonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined)?.trim() ?? ''

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey)

export const SUPABASE_SETUP_MESSAGE =
  'Supabase is not connected. Copy .env.example to .env, add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY from your Supabase project (Settings → API), then restart npm run dev.'

export function formatSupabaseClientError(error: unknown): string {
  if (!isSupabaseConfigured) return SUPABASE_SETUP_MESSAGE

  let message = 'Something went wrong. Please try again.'
  if (error instanceof Error && error.message.trim()) {
    message = error.message.trim()
  } else if (typeof error === 'object' && error !== null) {
    const maybe = error as { message?: unknown; details?: unknown; hint?: unknown; code?: unknown }
    const parts = [maybe.message, maybe.details, maybe.hint, maybe.code].filter(
      (part): part is string => typeof part === 'string' && part.trim().length > 0,
    )
    if (parts.length) message = parts.join(' — ')
  } else if (error != null) {
    message = String(error)
  }

  const lower = message.toLowerCase()
  if (lower.includes('failed to fetch') || lower.includes('networkerror')) {
    return 'Could not reach Supabase. Check your internet connection, confirm VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env are correct, then restart npm run dev.'
  }

  return message
}

if (!isSupabaseConfigured && import.meta.env.DEV) {
  console.warn(`[Cardea] ${SUPABASE_SETUP_MESSAGE}`)
}

/** Always defined so importing modules does not crash the app at startup. */
export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'public-anon-key',
)

/**
 * Returns `auth.users.id` for the current session, or creates an anonymous
 * session if none exists (same idea as onboarding persistence).
 * Returns null when browser Supabase is not configured.
 */
export async function ensureAuthUserId(): Promise<string | null> {
  if (!isSupabaseConfigured) return null
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

export type SavedQuestionSource = 'generated' | 'custom' | 'preset'

export type SavedQuestion = {
  id: string
  user_id: string
  question_id: string | null
  custom_text: string | null
  source: SavedQuestionSource
}

type SavedQuestionRow = {
  id: string
  user_id: string
  question_id: string | null
  custom_text: string | null
  source?: unknown
}

export function isSavedQuestionSource(value: unknown): value is SavedQuestionSource {
  return value === 'generated' || value === 'custom' || value === 'preset'
}

export function normalizeSavedQuestionSource(
  value: unknown,
  fallbackSource: SavedQuestionSource | null = null,
  questionId: string | null = null,
  customText: string | null = null,
): SavedQuestionSource {
  const normalized = typeof value === 'string' ? value.trim().toLowerCase() : ''

  if (normalized === 'generated' || normalized === 'custom' || normalized === 'preset') {
    return normalized
  }
  if (normalized === 'bank' || normalized === 'corpus') return 'preset'
  if (fallbackSource) return fallbackSource
  if (questionId) return 'preset'
  if (customText?.trim()) return 'custom'
  return 'custom'
}

export function normalizeSavedQuestion(
  row: SavedQuestionRow,
  fallbackSource: SavedQuestionSource | null = null,
): SavedQuestion {
  return {
    id: row.id,
    user_id: row.user_id,
    question_id: row.question_id,
    custom_text: row.custom_text,
    source: normalizeSavedQuestionSource(row.source, fallbackSource, row.question_id, row.custom_text),
  }
}

export type SupportResource = {
  id: string
  name: string
  description: string
  category: string
  link: string
  location: string | null
  zipcode: string | null
  age: string | null
}

export type Nudge = {
  id: number
  nudge_text: string
}
