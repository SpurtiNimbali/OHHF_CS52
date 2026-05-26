import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { clearMoodCheckInSession } from '../lib/moodEntries'
import { clearToolUsageForUser } from '../lib/toolUsage'
import type { MoodId } from './moodVariants'
import {
  moodVariantById,
  resolvedMoodTheme,
  MOOD_IDS,
  type MoodTheme,
  type MoodUiVariant,
} from './moodVariants'

const STORAGE_KEY = 'cardea-mood-id'
const STORAGE_DATE_KEY = 'cardea-mood-date'

const VALID: ReadonlySet<string> = new Set(MOOD_IDS)

/** Local calendar day (YYYY-MM-DD) for daily mood reset. */
export function moodLocalDateKey(date = new Date()): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function clearStoredMood() {
  try {
    localStorage.removeItem(STORAGE_KEY)
    localStorage.removeItem(STORAGE_DATE_KEY)
  } catch {
    /* ignore */
  }
  clearMoodCheckInSession()
}

/** New wellness day — clears mood storage and tool_usage (used markers). */
function resetWellnessDaySession() {
  clearStoredMood()
  void clearToolUsageForUser()
}

function readStoredMood(): MoodId | null {
  try {
    const today = moodLocalDateKey()
    const storedDate = localStorage.getItem(STORAGE_DATE_KEY)
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!storedDate || storedDate !== today) {
      if (raw || storedDate) resetWellnessDaySession()
      return null
    }
    if (raw && VALID.has(raw)) return raw as MoodId
    clearStoredMood()
  } catch {
    /* ignore */
  }
  return null
}

/** Calendar day key for wellness UI (tool "used" markers, etc.) — follows mood storage date while mood is set. */
function getWellnessDayKey(moodId: MoodId | null): string {
  const today = moodLocalDateKey()
  if (!moodId) return today
  try {
    const storedDate = localStorage.getItem(STORAGE_DATE_KEY)
    if (storedDate) return storedDate
  } catch {
    /* ignore */
  }
  return today
}

export type MoodContextValue = {
  moodId: MoodId | null
  setMoodId: (id: MoodId | null) => void
  /** Local YYYY-MM-DD for today's wellness session; resets when mood resets (not at midnight while tab stays open). */
  wellnessDayKey: string
  variant: MoodUiVariant | null
  theme: MoodTheme
}

const MoodContext = createContext<MoodContextValue | null>(null)

export function MoodProvider({ children }: { children: ReactNode }) {
  const [moodId, setMoodIdState] = useState<MoodId | null>(readStoredMood)

  /** Re-read storage when the user returns to the app — not on a midnight timer while the tab stays open. */
  useEffect(() => {
    const applyStoredMoodForToday = () => {
      setMoodIdState(readStoredMood())
    }

    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        applyStoredMoodForToday()
      }
    }

    const onPageShow = (event: PageTransitionEvent) => {
      if (event.persisted) applyStoredMoodForToday()
    }

    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('pageshow', onPageShow)
    return () => {
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('pageshow', onPageShow)
    }
  }, [])

  const setMoodId = useCallback((id: MoodId | null) => {
    setMoodIdState(id)
    try {
      if (id) {
        localStorage.setItem(STORAGE_KEY, id)
        localStorage.setItem(STORAGE_DATE_KEY, moodLocalDateKey())
      } else {
        clearStoredMood()
      }
    } catch {
      /* ignore */
    }
  }, [])

  const value = useMemo<MoodContextValue>(() => {
    const variant = moodId ? moodVariantById(moodId) : null
    const theme = resolvedMoodTheme(moodId)
    return {
      moodId,
      setMoodId,
      wellnessDayKey: getWellnessDayKey(moodId),
      variant,
      theme,
    }
  }, [moodId, setMoodId])

  return <MoodContext.Provider value={value}>{children}</MoodContext.Provider>
}

export function useMood(): MoodContextValue {
  const ctx = useContext(MoodContext)
  if (!ctx) throw new Error('useMood must be used within MoodProvider')
  return ctx
}
