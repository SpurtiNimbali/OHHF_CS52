import type { MoodId } from '../mood/moodVariants'
import { MOOD_IDS } from '../mood/moodVariants'
import { supabase, ensureAuthUserId, formatSupabaseClientError, isSupabaseConfigured } from './supabase'
import { authFetch, getAccessToken } from './authenticatedApi'

/** Number of mood check-ins shown in the wellness gradient timeline. */
export const RECENT_MOOD_CHECKINS_LIMIT = 7

export type MoodEntryRow = {
  id: string
  user_id: string
  mood: MoodId
  if_chat: boolean
  timestamp: string
}

const LATEST_MOOD_ENTRY_KEY = 'cardea-latest-mood-entry-id'
const SAVED_MOOD_CHECKIN_KEY = 'cardea-saved-mood-checkin'

type SavedMoodCheckIn = { moodId: MoodId; entryId: string }

const RLS_SETUP_HINT =
  'Supabase permissions: open SQL Editor in your project and run supabase/migrations/20260521230000_mood_journal_entries_rls.sql (or run npm run server:dev in a second terminal).'

function isRlsError(error: unknown): boolean {
  if (typeof error === 'object' && error !== null) {
    const code = (error as { code?: string }).code
    const message = String((error as { message?: string }).message ?? '')
    return code === '42501' || message.toLowerCase().includes('row-level security')
  }
  return false
}

function isMoodId(value: string): value is MoodId {
  return (MOOD_IDS as readonly string[]).includes(value)
}

function normalizeRow(row: Record<string, unknown>, fallbackMood?: MoodId): MoodEntryRow | null {
  const moodRaw = typeof row.mood === 'string' ? row.mood : ''
  const mood = isMoodId(moodRaw) ? moodRaw : fallbackMood
  if (!mood) return null
  return {
    id: String(row.id),
    user_id: String(row.user_id),
    mood,
    if_chat: Boolean(row.if_chat),
    timestamp: String(row.timestamp),
  }
}

export function setLatestMoodEntryId(id: string | null) {
  try {
    if (id) sessionStorage.setItem(LATEST_MOOD_ENTRY_KEY, id)
    else sessionStorage.removeItem(LATEST_MOOD_ENTRY_KEY)
  } catch {
    /* ignore */
  }
}

export function clearMoodCheckInSession() {
  setLatestMoodEntryId(null)
  try {
    sessionStorage.removeItem(SAVED_MOOD_CHECKIN_KEY)
  } catch {
    /* ignore */
  }
}

function getSavedMoodCheckIn(): SavedMoodCheckIn | null {
  try {
    const raw = sessionStorage.getItem(SAVED_MOOD_CHECKIN_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as SavedMoodCheckIn
    if (typeof parsed.moodId === 'string' && typeof parsed.entryId === 'string' && isMoodId(parsed.moodId)) {
      return parsed
    }
  } catch {
    /* ignore */
  }
  return null
}

function setSavedMoodCheckIn(moodId: MoodId, entryId: string) {
  try {
    sessionStorage.setItem(SAVED_MOOD_CHECKIN_KEY, JSON.stringify({ moodId, entryId }))
    setLatestMoodEntryId(entryId)
  } catch {
    /* ignore */
  }
}

export function getLatestMoodEntryId(): string | null {
  try {
    return sessionStorage.getItem(LATEST_MOOD_ENTRY_KEY)
  } catch {
    return null
  }
}

async function insertMoodEntryDirect(mood: MoodId, userId: string): Promise<MoodEntryRow | null> {
  const { data, error } = await supabase
    .from('mood_entries')
    .insert({
      user_id: userId,
      mood,
      if_chat: false,
      timestamp: new Date().toISOString(),
    })
    .select('id, user_id, mood, if_chat, timestamp')
    .single()

  if (error) {
    console.warn('[mood_entries] direct insert failed:', formatSupabaseClientError(error))
    if (isRlsError(error)) console.warn('[mood_entries]', RLS_SETUP_HINT)
    return null
  }

  return normalizeRow(data as Record<string, unknown>, mood)
}

async function insertMoodEntryApi(mood: MoodId): Promise<{ entry: MoodEntryRow | null; error: string | null }> {
  const token = await getAccessToken()
  if (!token) {
    return { entry: null, error: 'Sign in required to save your check-in.' }
  }

  try {
    const res = await authFetch('/api/mood-entries', {
      method: 'POST',
      body: JSON.stringify({ mood }),
    })
    const body = (await res.json()) as { entry?: Record<string, unknown>; error?: string }
    if (!res.ok) {
      return {
        entry: null,
        error: body.error ?? `Could not save (${res.status}). Is npm run server:dev running?`,
      }
    }
    const entry = body.entry ? normalizeRow(body.entry, mood) : null
    if (!entry) return { entry: null, error: 'Save failed — unexpected response.' }
    return { entry, error: null }
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Network error'
    return {
      entry: null,
      error: `${msg}. Start the API with npm run server:dev.`,
    }
  }
}

export async function insertMoodEntry(
  mood: MoodId,
): Promise<{ entry: MoodEntryRow | null; error: string | null }> {
  if (!isSupabaseConfigured) {
    return { entry: null, error: 'Supabase is not configured in .env.' }
  }

  const userId = await ensureAuthUserId()
  if (!userId) {
    return { entry: null, error: 'Sign in required to save your check-in.' }
  }

  // API bypasses RLS (service role). Try first when server:dev is running.
  const apiFirst = await insertMoodEntryApi(mood)
  if (apiFirst.entry) {
    setSavedMoodCheckIn(mood, apiFirst.entry.id)
    return { entry: apiFirst.entry, error: null }
  }

  let entry = await insertMoodEntryDirect(mood, userId)
  if (!entry) {
    const apiErr = apiFirst.error
    if (apiErr?.includes('server:dev') || apiErr?.includes('Network') || apiErr?.includes('fetch')) {
      return { entry: null, error: `${apiErr} ${RLS_SETUP_HINT}` }
    }
    return { entry: null, error: apiErr ?? RLS_SETUP_HINT }
  }

  setSavedMoodCheckIn(mood, entry.id)
  return { entry, error: null }
}

/** Save to Supabase only if this mood has not been saved in the current check-in session. */
export async function saveMoodCheckInIfNeeded(
  mood: MoodId,
): Promise<{ entry: MoodEntryRow | null; error: string | null; alreadySaved: boolean }> {
  const saved = getSavedMoodCheckIn()
  if (saved?.moodId === mood && saved.entryId) {
    const rows = await fetchMoodEntries(RECENT_MOOD_CHECKINS_LIMIT)
    const existing = rows.find((r) => r.id === saved.entryId && r.mood === mood)
    if (existing) {
      return { entry: existing, error: null, alreadySaved: true }
    }
  }

  const result = await insertMoodEntry(mood)
  if (result.entry) {
    return { ...result, alreadySaved: false }
  }
  return { entry: null, error: result.error, alreadySaved: false }
}

export async function markMoodEntryIfChat(entryId: string): Promise<void> {
  if (!isSupabaseConfigured || !entryId) return

  const { error } = await supabase.from('mood_entries').update({ if_chat: true }).eq('id', entryId)
  if (!error) return

  try {
    await authFetch(`/api/mood-entries/${encodeURIComponent(entryId)}/if-chat`, { method: 'PATCH' })
  } catch {
    console.warn('[mood_entries] if_chat update failed')
  }
}

async function fetchMoodEntriesDirect(
  userId: string,
  limit: number,
): Promise<{ rows: MoodEntryRow[]; failed: boolean }> {
  const { data, error } = await supabase
    .from('mood_entries')
    .select('id, user_id, mood, if_chat, timestamp')
    .eq('user_id', userId)
    .order('timestamp', { ascending: false })
    .limit(limit)

  if (error) {
    console.warn('[mood_entries] direct fetch failed:', formatSupabaseClientError(error))
    return { rows: [], failed: true }
  }

  if (!Array.isArray(data)) return { rows: [], failed: false }

  const rows = data
    .map((row) => normalizeRow(row as Record<string, unknown>))
    .filter((row): row is MoodEntryRow => row !== null)
  return { rows, failed: false }
}

async function fetchMoodEntriesApi(limit: number): Promise<MoodEntryRow[]> {
  try {
    const res = await authFetch(`/api/mood-entries?limit=${limit}`)
    if (!res.ok) return []
    const body = (await res.json()) as { entries?: Record<string, unknown>[] }
    if (!Array.isArray(body.entries)) return []
    return body.entries
      .map((row) => normalizeRow(row))
      .filter((row): row is MoodEntryRow => row !== null)
  } catch {
    return []
  }
}

export async function fetchMoodEntries(limit = RECENT_MOOD_CHECKINS_LIMIT): Promise<MoodEntryRow[]> {
  if (!isSupabaseConfigured) return []
  const userId = await ensureAuthUserId()
  if (!userId) return []

  const [direct, apiRows] = await Promise.all([
    fetchMoodEntriesDirect(userId, limit),
    fetchMoodEntriesApi(limit),
  ])

  if (!direct.failed && direct.rows.length > 0) return direct.rows
  if (apiRows.length > 0) return apiRows
  if (!direct.failed) return direct.rows
  return apiRows
}

export async function fetchLatestMoodEntry(): Promise<MoodEntryRow | null> {
  const rows = await fetchMoodEntries(1)
  return rows[0] ?? null
}

/** Save check-in to Supabase if not saved yet this session; return entry for chat. */
export async function ensureMoodEntryForChat(
  mood: MoodId,
): Promise<{ entry: MoodEntryRow | null; entryId: string | null; error: string | null }> {
  const { entry, error } = await saveMoodCheckInIfNeeded(mood)
  return { entry, entryId: entry?.id ?? null, error }
}

export function markMoodCheckInSaved(mood: MoodId, entryId: string) {
  setSavedMoodCheckIn(mood, entryId)
}
