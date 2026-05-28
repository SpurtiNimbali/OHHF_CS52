import type { ReflectionPrompt } from './reflectionPrompts'

export const MICRO_JOURNAL_DEFAULT_PROMPT =
  "Write down how you're feeling today. Use your own words — there's no right format."

export const MICRO_JOURNAL_LEGACY_PROMPTS = new Set([
  MICRO_JOURNAL_DEFAULT_PROMPT,
  'How are you feeling today?',
  'Write down your feelings',
])

export type MicroJournalDraft = {
  prompt: string
  promptId?: number
  tags: string[]
}

export const JOURNAL_TAG_OPTIONS = [
  'reflection',
  'gratitude',
  'connection',
  'parenting',
  'self-care',
  'hope',
  'hard-day',
  'relationships',
  'body',
] as const

export function isStandardMicroJournalPrompt(prompt: string) {
  return MICRO_JOURNAL_LEGACY_PROMPTS.has(prompt.trim())
}

export function defaultMicroJournalDraft(): MicroJournalDraft {
  return { prompt: MICRO_JOURNAL_DEFAULT_PROMPT, tags: [] }
}

export function microJournalDraftFromReflection(
  reflection: ReflectionPrompt,
  moodId?: string | null,
): MicroJournalDraft {
  const tags = new Set<string>(['reflection', ...reflection.mood_tags])
  if (moodId) tags.add(moodId)
  return {
    prompt: reflection.prompt_text,
    promptId: reflection.id > 0 ? reflection.id : undefined,
    tags: [...tags],
  }
}

export function formatJournalTag(tag: string) {
  return tag
    .split(/[-_]/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

export const PENDING_JOURNAL_DRAFT_KEY = 'cardea-wellness-pending-journal-prompt'

export function savePendingJournalDraft(draft: MicroJournalDraft) {
  try {
    sessionStorage.setItem(PENDING_JOURNAL_DRAFT_KEY, JSON.stringify(draft))
  } catch {
    /* ignore */
  }
}

export function consumePendingJournalDraft(): MicroJournalDraft | null {
  try {
    const raw = sessionStorage.getItem(PENDING_JOURNAL_DRAFT_KEY)
    if (!raw) return null
    sessionStorage.removeItem(PENDING_JOURNAL_DRAFT_KEY)
    if (raw.startsWith('{')) {
      const parsed = JSON.parse(raw) as Partial<MicroJournalDraft>
      if (!parsed.prompt || typeof parsed.prompt !== 'string') return null
      return {
        prompt: parsed.prompt,
        promptId: typeof parsed.promptId === 'number' ? parsed.promptId : undefined,
        tags: Array.isArray(parsed.tags)
          ? parsed.tags.filter((tag): tag is string => typeof tag === 'string')
          : [],
      }
    }
    return { prompt: raw, tags: ['reflection'] }
  } catch {
    return null
  }
}
