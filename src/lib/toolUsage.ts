import { supabase, ensureAuthUserId, formatSupabaseClientError, isSupabaseConfigured } from './supabase'
import { authFetch, getAccessToken } from './authenticatedApi'

const RLS_SETUP_HINT =
  'Supabase permissions: run supabase/migrations/20260522120000_tool_usage_rls.sql (or npm run server:dev).'

/** Fired when mood/wellness day resets (same moment as used-marker reset). */
export const WELLNESS_DAY_RESET_EVENT = 'cardea-wellness-day-reset'

export type ToolUsageRow = {
  id: string
  user_id: string
  tool_id: string
  timestamp: string
}

function normalizeRow(row: Record<string, unknown>): ToolUsageRow | null {
  const tool_id = typeof row.tool_id === 'string' ? row.tool_id.trim() : ''
  if (!tool_id) return null
  return {
    id: String(row.id),
    user_id: String(row.user_id),
    tool_id,
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

async function fetchToolUsageDirect(userId: string, limit: number): Promise<ToolUsageRow[]> {
  const { data, error } = await supabase
    .from('tool_usage')
    .select('id, user_id, tool_id, timestamp')
    .eq('user_id', userId)
    .order('timestamp', { ascending: false })
    .limit(limit)

  if (error) {
    console.warn('[tool_usage] fetch failed:', formatSupabaseClientError(error))
    return []
  }

  if (!Array.isArray(data)) return []
  return data
    .map((row) => normalizeRow(row as Record<string, unknown>))
    .filter((row): row is ToolUsageRow => row !== null)
}

async function fetchToolUsageApi(limit: number): Promise<ToolUsageRow[]> {
  try {
    const res = await authFetch(`/api/tool-usage?limit=${limit}`)
    if (!res.ok) return []
    const body = (await res.json()) as { usage?: Record<string, unknown>[] }
    if (!Array.isArray(body.usage)) return []
    return body.usage
      .map((row) => normalizeRow(row))
      .filter((row): row is ToolUsageRow => row !== null)
  } catch {
    return []
  }
}

export async function fetchToolUsage(limit = 200): Promise<ToolUsageRow[]> {
  if (!isSupabaseConfigured) return []
  const userId = await ensureAuthUserId()
  if (!userId) return []

  const [direct, api] = await Promise.all([
    fetchToolUsageDirect(userId, limit),
    fetchToolUsageApi(limit),
  ])
  if (direct.length > 0) return direct
  return api
}

async function insertToolUsageDirect(userId: string, toolId: string): Promise<ToolUsageRow | null> {
  const { data, error } = await supabase
    .from('tool_usage')
    .insert({
      user_id: userId,
      tool_id: toolId,
      timestamp: new Date().toISOString(),
    })
    .select('id, user_id, tool_id, timestamp')
    .single()

  if (error) {
    console.warn('[tool_usage] insert failed:', formatSupabaseClientError(error))
    if (isRlsError(error)) console.warn('[tool_usage]', RLS_SETUP_HINT)
    return null
  }

  return normalizeRow(data as Record<string, unknown>)
}

async function insertToolUsageApi(
  toolId: string,
): Promise<{ row: ToolUsageRow | null; error: string | null }> {
  const token = await getAccessToken()
  if (!token) {
    return { row: null, error: null }
  }

  try {
    const res = await authFetch('/api/tool-usage', {
      method: 'POST',
      body: JSON.stringify({ tool_id: toolId }),
    })
    const body = (await res.json()) as { usage?: Record<string, unknown>; error?: string }
    if (!res.ok) {
      return { row: null, error: body.error ?? null }
    }
    const row = body.usage ? normalizeRow(body.usage) : null
    return { row, error: null }
  } catch {
    return { row: null, error: null }
  }
}

export async function insertToolUsage(
  toolId: string,
): Promise<{ row: ToolUsageRow | null; error: string | null }> {
  if (!isSupabaseConfigured) {
    return { row: null, error: null }
  }

  const userId = await ensureAuthUserId()
  if (!userId) {
    return { row: null, error: null }
  }

  const id = toolId.trim()
  if (!id) {
    return { row: null, error: null }
  }

  const apiFirst = await insertToolUsageApi(id)
  if (apiFirst.row) return { row: apiFirst.row, error: null }

  const direct = await insertToolUsageDirect(userId, id)
  return { row: direct, error: apiFirst.error }
}

async function clearToolUsageDirect(userId: string): Promise<boolean> {
  const { error } = await supabase.from('tool_usage').delete().eq('user_id', userId)

  if (error) {
    console.warn('[tool_usage] clear failed:', formatSupabaseClientError(error))
    if (isRlsError(error)) console.warn('[tool_usage]', RLS_SETUP_HINT)
    return false
  }

  return true
}

async function clearToolUsageApi(): Promise<boolean> {
  const token = await getAccessToken()
  if (!token) return false

  try {
    const res = await authFetch('/api/tool-usage', { method: 'DELETE' })
    return res.ok
  } catch {
    return false
  }
}

/** Delete all tool_usage rows for the signed-in user (wellness day reset). */
export async function clearToolUsageForUser(): Promise<void> {
  if (!isSupabaseConfigured) return
  const userId = await ensureAuthUserId()
  if (!userId) return

  const apiOk = await clearToolUsageApi()
  if (!apiOk) {
    await clearToolUsageDirect(userId)
  }

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(WELLNESS_DAY_RESET_EVENT))
  }
}
