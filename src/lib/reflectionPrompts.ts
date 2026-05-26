import { isSupabaseConfigured, supabase } from './supabase'

export type ReflectionPrompt = {
  id: number
  prompt_text: string
  mood_tags: string[]
}

const DAILY_SELECTION_KEY = 'cardea-reflection-daily'

const FALLBACK_PROMPTS: ReflectionPrompt[] = [
  { id: -1, prompt_text: 'What is one thing you did today that took courage?', mood_tags: ['overwhelmed', 'scared', 'exhausted'] },
  { id: -2, prompt_text: 'What small joy can you create today, even if everything feels heavy?', mood_tags: ['sad', 'disconnected', 'exhausted', 'numb'] },
  { id: -3, prompt_text: 'What is one thing you are proud of this week, no matter how small?', mood_tags: ['happy', 'hopeful', 'calm'] },
]

function todayKey(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function fisherYates<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    const tmp = a[i]!
    a[i] = a[j]!
    a[j] = tmp
  }
  return a
}

type DailySelection = { date: string; ids: number[] }

function loadSelection(): DailySelection | null {
  try {
    const raw = localStorage.getItem(DAILY_SELECTION_KEY)
    return raw ? (JSON.parse(raw) as DailySelection) : null
  } catch { return null }
}

function saveSelection(sel: DailySelection): void {
  try { localStorage.setItem(DAILY_SELECTION_KEY, JSON.stringify(sel)) } catch { /* ignore */ }
}

export async function fetchReflectionPrompts(): Promise<ReflectionPrompt[]> {
  if (!isSupabaseConfigured) return FALLBACK_PROMPTS
  const { data, error } = await supabase
    .from('reflection_prompts')
    .select('id, prompt_text, mood_tags')
    .order('id')
  if (error || !data || data.length === 0) return FALLBACK_PROMPTS
  return data as ReflectionPrompt[]
}

/**
 * Maps app MoodIds to the broader tag vocabulary used in the DB.
 * Allows matching even when existing prompts use synonyms like "stressed" or "anxious".
 */
const MOOD_TAG_ALIASES: Record<string, string[]> = {
  overwhelmed:  ['overwhelmed', 'stressed', 'burnout'],
  exhausted:    ['exhausted', 'tired', 'burnout'],
  scared:       ['scared', 'anxious'],
  sad:          ['sad', 'unmotivated', 'grief'],
  disconnected: ['disconnected', 'lonely'],
  numb:         ['numb'],
  happy:        ['happy', 'joyful'],
  calm:         ['calm', 'peaceful'],
  hopeful:      ['hopeful', 'encouraged'],
  angry:        ['angry', 'frustrated'],
}

function tagsForMood(moodId: string): string[] {
  return MOOD_TAG_ALIASES[moodId] ?? [moodId]
}

/**
 * Returns `count` prompts for today. Prompts whose mood_tags overlap the current mood
 * (via alias map) are prioritised. The daily selection is stable for the calendar day.
 */
export function pickDailyPrompts(
  allPrompts: ReflectionPrompt[],
  moodId: string | null,
  count = 3,
): ReflectionPrompt[] {
  if (allPrompts.length === 0) return []

  const today = todayKey()
  const stored = loadSelection()
  if (stored?.date === today && stored.ids.length >= count) {
    const byId = new Map(allPrompts.map((p) => [p.id, p]))
    const resolved = stored.ids
      .slice(0, count)
      .map((id) => byId.get(id))
      .filter((p): p is ReflectionPrompt => p != null)
    if (resolved.length >= count) return resolved
  }

  const tags = moodId ? tagsForMood(moodId) : []
  const moodMatches = tags.length
    ? allPrompts.filter((p) => p.mood_tags.some((t) => tags.includes(t)))
    : []
  const others = allPrompts.filter((p) => !moodMatches.includes(p))
  const ordered = [...fisherYates(moodMatches), ...fisherYates(others)]
  const selected = ordered.slice(0, count)

  saveSelection({ date: today, ids: selected.map((p) => p.id) })
  return selected
}
