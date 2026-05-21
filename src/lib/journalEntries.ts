import { supabase, ensureAuthUserId, formatSupabaseClientError, isSupabaseConfigured } from './supabase'
import { authFetch, getAccessToken } from './authenticatedApi'

const RLS_SETUP_HINT =
  'Supabase permissions: open SQL Editor and run supabase/migrations/20260521230000_mood_journal_entries_rls.sql (or run npm run server:dev in a second terminal).'

function isRlsError(error: unknown): boolean {
  if (typeof error === 'object' && error !== null) {
    const code = (error as { code?: string }).code
    const message = String((error as { message?: string }).message ?? '')
    return code === '42501' || message.toLowerCase().includes('row-level security')
  }
  return false
}

export type JournalEntryRow = {
  id: string
  user_id: string
  prompt: string
  entry: string
  timestamp: string
}

function normalizeRow(
  row: Record<string, unknown>,
  fallback?: { prompt: string; entry: string },
): JournalEntryRow | null {
  const entryText = typeof row.entry === 'string' ? row.entry : fallback?.entry ?? ''
  if (!entryText.trim()) return null
  return {
    id: String(row.id),
    user_id: String(row.user_id),
    prompt: String(row.prompt ?? fallback?.prompt ?? ''),
    entry: entryText,
    timestamp: String(row.timestamp),
  }
}

async function insertJournalEntryDirect(
  userId: string,
  prompt: string,
  entry: string,
): Promise<JournalEntryRow | null> {
  const { data, error } = await supabase
    .from('journal_entries')
    .insert({
      user_id: userId,
      prompt: prompt.trim(),
      entry,
      timestamp: new Date().toISOString(),
    })
    .select('id, user_id, prompt, entry, timestamp')
    .single()

  if (error) {
    console.warn('[journal_entries] direct insert failed:', formatSupabaseClientError(error))
    if (isRlsError(error)) console.warn('[journal_entries]', RLS_SETUP_HINT)
    return null
  }

  return normalizeRow(data as Record<string, unknown>, { prompt, entry })
}

async function insertJournalEntryApi(
  prompt: string,
  entry: string,
): Promise<{ row: JournalEntryRow | null; error: string | null }> {
  const token = await getAccessToken()
  if (!token) {
    return { row: null, error: 'Sign in required to save your journal entry.' }
  }

  try {
    const res = await authFetch('/api/journal-entries', {
      method: 'POST',
      body: JSON.stringify({ prompt, entry }),
    })
    const body = (await res.json()) as { entry?: Record<string, unknown>; error?: string }
    if (!res.ok) {
      return {
        row: null,
        error: body.error ?? `Could not save (${res.status}). Is npm run server:dev running?`,
      }
    }
    const row = body.entry ? normalizeRow(body.entry, { prompt, entry }) : null
    if (!row) return { row: null, error: 'Save failed — unexpected response.' }
    return { row, error: null }
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Network error'
    return {
      row: null,
      error: `${msg}. Start the API with npm run server:dev.`,
    }
  }
}

export async function insertJournalEntry(
  prompt: string,
  entry: string,
): Promise<{ entry: JournalEntryRow | null; error: string | null }> {
  if (!isSupabaseConfigured) {
    return { entry: null, error: 'Supabase is not configured in .env.' }
  }

  const userId = await ensureAuthUserId()
  if (!userId) {
    return { entry: null, error: 'Sign in required to save your journal entry.' }
  }

  const trimmed = entry.trim()
  if (!trimmed) {
    return { entry: null, error: 'Write something before saving.' }
  }

  const apiFirst = await insertJournalEntryApi(prompt, trimmed)
  if (apiFirst.row) return { entry: apiFirst.row, error: null }

  let row = await insertJournalEntryDirect(userId, prompt, trimmed)
  if (!row) {
    const apiErr = apiFirst.error
    if (apiErr?.includes('server:dev') || apiErr?.includes('Network') || apiErr?.includes('fetch')) {
      return { entry: null, error: `${apiErr} ${RLS_SETUP_HINT}` }
    }
    return { entry: null, error: apiErr ?? RLS_SETUP_HINT }
  }

  return { entry: row, error: null }
}

async function fetchJournalEntriesDirect(
  userId: string,
  limit: number,
): Promise<{ rows: JournalEntryRow[]; failed: boolean }> {
  const { data, error } = await supabase
    .from('journal_entries')
    .select('id, user_id, prompt, entry, timestamp')
    .eq('user_id', userId)
    .order('timestamp', { ascending: false })
    .limit(limit)

  if (error) {
    console.warn('[journal_entries] direct fetch failed:', formatSupabaseClientError(error))
    return { rows: [], failed: true }
  }

  if (!Array.isArray(data)) return { rows: [], failed: false }

  const rows = data
    .map((row) => normalizeRow(row as Record<string, unknown>))
    .filter((row): row is JournalEntryRow => row !== null)
  return { rows, failed: false }
}

async function fetchJournalEntriesApi(limit: number): Promise<JournalEntryRow[]> {
  try {
    const res = await authFetch(`/api/journal-entries?limit=${limit}`)
    if (!res.ok) return []
    const body = (await res.json()) as { entries?: Record<string, unknown>[] }
    if (!Array.isArray(body.entries)) return []
    return body.entries
      .map((row) => normalizeRow(row))
      .filter((row): row is JournalEntryRow => row !== null)
  } catch {
    return []
  }
}

export async function fetchJournalEntries(limit = 50): Promise<JournalEntryRow[]> {
  if (!isSupabaseConfigured) return []
  const userId = await ensureAuthUserId()
  if (!userId) return []

  const [direct, apiRows] = await Promise.all([
    fetchJournalEntriesDirect(userId, limit),
    fetchJournalEntriesApi(limit),
  ])

  if (!direct.failed && direct.rows.length > 0) return direct.rows
  if (apiRows.length > 0) return apiRows
  if (!direct.failed) return direct.rows
  return apiRows
}
