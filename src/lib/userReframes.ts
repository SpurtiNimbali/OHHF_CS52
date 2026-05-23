import { supabase, ensureAuthUserId, formatSupabaseClientError, isSupabaseConfigured } from './supabase'
import { authFetch, getAccessToken } from './authenticatedApi'

const RLS_SETUP_HINT =
  'Supabase permissions: run supabase/migrations/20260522000000_user_reframes_safe_places_rls.sql (or npm run server:dev).'

export type UserReframeRow = {
  id: string
  user_id: string | null
  thought: string
  reframe: string
  timestamp: string
}

function normalizeRow(row: Record<string, unknown>): UserReframeRow | null {
  const thought = typeof row.thought === 'string' ? row.thought : ''
  const reframe = typeof row.reframe === 'string' ? row.reframe : ''
  if (!thought.trim() || !reframe.trim()) return null
  return {
    id: String(row.id),
    user_id: row.user_id == null ? null : String(row.user_id),
    thought: thought.trim(),
    reframe: reframe.trim(),
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

async function fetchStarterReframesDirect(): Promise<UserReframeRow[]> {
  const { data, error } = await supabase
    .from('user_reframes')
    .select('id, user_id, thought, reframe, timestamp')
    .is('user_id', null)
    .order('timestamp', { ascending: true })
    .limit(6)

  if (error) {
    console.warn('[user_reframes] starter fetch failed:', formatSupabaseClientError(error))
    return []
  }

  if (!Array.isArray(data)) return []
  return data
    .map((row) => normalizeRow(row as Record<string, unknown>))
    .filter((row): row is UserReframeRow => row !== null)
}

async function fetchStarterReframesApi(): Promise<UserReframeRow[]> {
  try {
    const res = await authFetch('/api/user-reframes/starters')
    if (!res.ok) return []
    const body = (await res.json()) as { reframes?: Record<string, unknown>[] }
    if (!Array.isArray(body.reframes)) return []
    return body.reframes
      .map((row) => normalizeRow(row))
      .filter((row): row is UserReframeRow => row !== null)
  } catch {
    return []
  }
}

export async function fetchStarterReframes(): Promise<UserReframeRow[]> {
  if (!isSupabaseConfigured) return []
  await ensureAuthUserId()
  const [direct, api] = await Promise.all([fetchStarterReframesDirect(), fetchStarterReframesApi()])
  if (direct.length > 0) return direct
  return api
}

async function fetchMyReframesDirect(userId: string, limit: number): Promise<UserReframeRow[]> {
  const { data, error } = await supabase
    .from('user_reframes')
    .select('id, user_id, thought, reframe, timestamp')
    .eq('user_id', userId)
    .order('timestamp', { ascending: false })
    .limit(limit)

  if (error) {
    console.warn('[user_reframes] mine fetch failed:', formatSupabaseClientError(error))
    return []
  }

  if (!Array.isArray(data)) return []
  return data
    .map((row) => normalizeRow(row as Record<string, unknown>))
    .filter((row): row is UserReframeRow => row !== null)
}

async function fetchMyReframesApi(limit: number): Promise<UserReframeRow[]> {
  try {
    const res = await authFetch(`/api/user-reframes?limit=${limit}`)
    if (!res.ok) return []
    const body = (await res.json()) as { reframes?: Record<string, unknown>[] }
    if (!Array.isArray(body.reframes)) return []
    return body.reframes
      .map((row) => normalizeRow(row))
      .filter((row): row is UserReframeRow => row !== null)
  } catch {
    return []
  }
}

export async function fetchMyReframes(limit = 50): Promise<UserReframeRow[]> {
  if (!isSupabaseConfigured) return []
  const userId = await ensureAuthUserId()
  if (!userId) return []

  const [direct, api] = await Promise.all([
    fetchMyReframesDirect(userId, limit),
    fetchMyReframesApi(limit),
  ])
  if (direct.length > 0) return direct
  return api
}

async function insertReframeDirect(
  userId: string,
  thought: string,
  reframe: string,
): Promise<UserReframeRow | null> {
  const { data, error } = await supabase
    .from('user_reframes')
    .insert({
      user_id: userId,
      thought,
      reframe,
      timestamp: new Date().toISOString(),
    })
    .select('id, user_id, thought, reframe, timestamp')
    .single()

  if (error) {
    console.warn('[user_reframes] insert failed:', formatSupabaseClientError(error))
    if (isRlsError(error)) console.warn('[user_reframes]', RLS_SETUP_HINT)
    return null
  }

  return normalizeRow(data as Record<string, unknown>)
}

async function insertReframeApi(
  thought: string,
  reframe: string,
): Promise<{ row: UserReframeRow | null; error: string | null }> {
  const token = await getAccessToken()
  if (!token) {
    return { row: null, error: 'Sign in required to save your reframe.' }
  }

  try {
    const res = await authFetch('/api/user-reframes', {
      method: 'POST',
      body: JSON.stringify({ thought, reframe }),
    })
    const body = (await res.json()) as { reframe?: Record<string, unknown>; error?: string }
    if (!res.ok) {
      return { row: null, error: body.error ?? `Could not save (${res.status}).` }
    }
    const row = body.reframe ? normalizeRow(body.reframe) : null
    if (!row) return { row: null, error: 'Save failed — unexpected response.' }
    return { row, error: null }
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Network error'
    return { row: null, error: `${msg}. Start the API with npm run server:dev.` }
  }
}

export async function insertUserReframe(
  thought: string,
  reframe: string,
): Promise<{ row: UserReframeRow | null; error: string | null }> {
  if (!isSupabaseConfigured) {
    return { row: null, error: 'Supabase is not configured in .env.' }
  }

  const userId = await ensureAuthUserId()
  if (!userId) {
    return { row: null, error: 'Sign in required to save your reframe.' }
  }

  const t = thought.trim()
  const r = reframe.trim()
  if (!t || !r) {
    return { row: null, error: 'Add both a thought and a reframe.' }
  }

  const apiFirst = await insertReframeApi(t, r)
  if (apiFirst.row) return { row: apiFirst.row, error: null }

  const direct = await insertReframeDirect(userId, t, r)
  if (!direct) {
    return { row: null, error: apiFirst.error ?? RLS_SETUP_HINT }
  }
  return { row: direct, error: null }
}
