import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import type { MoodId } from './moodVariants'
import { moodVariantById, resolvedMoodTheme, type MoodTheme, type MoodUiVariant } from './moodVariants'

const STORAGE_KEY = 'cardea-mood-id'

const VALID: ReadonlySet<string> = new Set(['calm', 'hopeful', 'uncertain', 'tired', 'energized'])

function readStoredMood(): MoodId | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw && VALID.has(raw)) return raw as MoodId
  } catch {
    /* ignore */
  }
  return null
}

export type MoodContextValue = {
  moodId: MoodId | null
  setMoodId: (id: MoodId | null) => void
  variant: MoodUiVariant | null
  theme: MoodTheme
}

const MoodContext = createContext<MoodContextValue | null>(null)

export function MoodProvider({ children }: { children: ReactNode }) {
  const [moodId, setMoodIdState] = useState<MoodId | null>(readStoredMood)

  const setMoodId = useCallback((id: MoodId | null) => {
    setMoodIdState(id)
    try {
      if (id) localStorage.setItem(STORAGE_KEY, id)
      else localStorage.removeItem(STORAGE_KEY)
    } catch {
      /* ignore */
    }
  }, [])

  const value = useMemo<MoodContextValue>(() => {
    const variant = moodId ? moodVariantById(moodId) : null
    const theme = resolvedMoodTheme(moodId)
    return { moodId, setMoodId, variant, theme }
  }, [moodId, setMoodId])

  return <MoodContext.Provider value={value}>{children}</MoodContext.Provider>
}

export function useMood(): MoodContextValue {
  const ctx = useContext(MoodContext)
  if (!ctx) throw new Error('useMood must be used within MoodProvider')
  return ctx
}
