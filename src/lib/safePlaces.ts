import { supabase, ensureAuthUserId, formatSupabaseClientError, isSupabaseConfigured } from './supabase'
import { authFetch, getAccessToken } from './authenticatedApi'

const RLS_SETUP_HINT =
  'Supabase permissions: run supabase/migrations/20260522000000_user_reframes_safe_places_rls.sql (or npm run server:dev).'

export type SafePlaceRow = {
  id: string
  user_id: string
  name: string
  description: string
  timestamp: string
}

function normalizeRow(row: Record<string, unknown>): SafePlaceRow | null {
  const name = typeof row.name === 'string' ? row.name.trim() : ''
  const description = typeof row.description === 'string' ? row.description.trim() : ''
  if (!name) return null
  return {
    id: String(row.id),
    user_id: String(row.user_id),
    name,
    description,
    timestamp: String(row.timestamp),
  }
}

function isRlsError(error: unknown): boolean {
  if (typeof error === 'object' && error !== null) {
    const code = (error as { code?: string }).code
    const message = String((error as { message?: string }).message ?? '')
    return code === '42501' || message.toLowerCase().includes('row-level security')
  }
  return false
}

async function fetchSafePlacesDirect(userId: string, limit: number): Promise<SafePlaceRow[]> {
  const { data, error } = await supabase
    .from('safe_places')
    .select('id, user_id, name, description, timestamp')
    .eq('user_id', userId)
    .order('timestamp', { ascending: false })
    .limit(limit)

  if (error) {
    console.warn('[safe_places] fetch failed:', formatSupabaseClientError(error))
    return []
  }

  if (!Array.isArray(data)) return []
  return data
    .map((row) => normalizeRow(row as Record<string, unknown>))
    .filter((row): row is SafePlaceRow => row !== null)
}

async function fetchSafePlacesApi(limit: number): Promise<SafePlaceRow[]> {
  try {
    const res = await authFetch(`/api/safe-places?limit=${limit}`)
    if (!res.ok) return []
    const body = (await res.json()) as { places?: Record<string, unknown>[] }
    if (!Array.isArray(body.places)) return []
    return body.places
      .map((row) => normalizeRow(row))
      .filter((row): row is SafePlaceRow => row !== null)
  } catch {
    return []
  }
}

export async function fetchSafePlaces(limit = 20): Promise<SafePlaceRow[]> {
  if (!isSupabaseConfigured) return []
  const userId = await ensureAuthUserId()
  if (!userId) return []

  const [direct, api] = await Promise.all([
    fetchSafePlacesDirect(userId, limit),
    fetchSafePlacesApi(limit),
  ])
  if (direct.length > 0) return direct
  return api
}

/** Latest saved place (e.g. past entries). */
export async function fetchSafePlace(): Promise<SafePlaceRow | null> {
  const rows = await fetchSafePlaces(1)
  return rows[0] ?? null
}

async function insertSafePlaceDirect(
  userId: string,
  name: string,
  description: string,
): Promise<SafePlaceRow | null> {
  const { data, error } = await supabase
    .from('safe_places')
    .insert({
      user_id: userId,
      name,
      description,
      timestamp: new Date().toISOString(),
    })
    .select('id, user_id, name, description, timestamp')
    .single()

  if (error) {
    console.warn('[safe_places] insert failed:', formatSupabaseClientError(error))
    if (isRlsError(error)) console.warn('[safe_places]', RLS_SETUP_HINT)
    return null
  }

  return normalizeRow(data as Record<string, unknown>)
}

async function insertSafePlaceApi(
  name: string,
  description: string,
): Promise<{ row: SafePlaceRow | null; error: string | null }> {
  const token = await getAccessToken()
  if (!token) {
    return { row: null, error: 'Sign in required to save your safe place.' }
  }

  try {
    const res = await authFetch('/api/safe-places', {
      method: 'POST',
      body: JSON.stringify({ name, description }),
    })
    const body = (await res.json()) as { place?: Record<string, unknown>; error?: string }
    if (!res.ok) {
      return { row: null, error: body.error ?? `Could not save (${res.status}).` }
    }
    const row = body.place ? normalizeRow(body.place) : null
    if (!row) return { row: null, error: 'Save failed — unexpected response.' }
    return { row, error: null }
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Network error'
    return { row: null, error: `${msg}. Start the API with npm run server:dev.` }
  }
}

export async function insertSafePlace(
  name: string,
  description: string,
): Promise<{ row: SafePlaceRow | null; error: string | null }> {
  if (!isSupabaseConfigured) {
    return { row: null, error: 'Supabase is not configured in .env.' }
  }

  const userId = await ensureAuthUserId()
  if (!userId) {
    return { row: null, error: 'Sign in required to save your safe place.' }
  }

  const n = name.trim()
  const d = description.trim()
  if (!n) {
    return { row: null, error: 'Give your safe place a name.' }
  }

  const apiFirst = await insertSafePlaceApi(n, d)
  if (apiFirst.row) return { row: apiFirst.row, error: null }

  const direct = await insertSafePlaceDirect(userId, n, d)
  if (!direct) {
    return { row: null, error: apiFirst.error ?? RLS_SETUP_HINT }
  }
  return { row: direct, error: null }
}

/** @deprecated Use insertSafePlace — each save adds a new place. */
export const upsertSafePlace = insertSafePlace
