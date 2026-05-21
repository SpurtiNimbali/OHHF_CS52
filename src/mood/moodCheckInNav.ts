import type { MoodId } from './moodVariants'

/** Passed via React Router when opening chat from a mood check-in. */
export type MoodCheckInChatState = {
  prefill: string
  moodId: MoodId
  moodEntryId: string | null
}

export function isMoodCheckInChatState(value: unknown): value is MoodCheckInChatState {
  if (!value || typeof value !== 'object') return false
  const s = value as Record<string, unknown>
  return (
    typeof s.prefill === 'string' &&
    typeof s.moodId === 'string' &&
    (s.moodEntryId === null || typeof s.moodEntryId === 'string')
  )
}
