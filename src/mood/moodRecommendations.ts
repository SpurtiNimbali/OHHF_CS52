/**
 * Mood → home cards & wellness tools (CS 51/52 team doc).
 * Single source of truth for personalized surfaces.
 */

import type { MoodId } from './moodVariants'

export type WellnessToolId =
  | 'breathing'
  | 'grounding'
  | 'physical-regulation'
  | 'body-scan'
  | 'name-it'
  | 'feelings-wheel'
  | 'micro-journal'
  | 'reframes'
  | 'safe-place'
  | 'stop-skill'
  | 'today-nudge'
  | 'night-reset'

/** Primary wellness tool surfaced on the home “Wellness tools” card */
export const MOOD_PRIMARY_WELLNESS_TOOL: Record<MoodId, WellnessToolId> = {
  overwhelmed: 'breathing',
  exhausted: 'body-scan',
  angry: 'stop-skill',
  scared: 'safe-place',
  sad: 'name-it',
  disconnected: 'body-scan',
  numb: 'feelings-wheel',
  hopeful: 'micro-journal',
  happy: 'micro-journal',
  calm: 'body-scan',
}

/** Home “Wellness tools” card copy — names the primary exercise */
export const MOOD_WELLNESS_HOME_DESCRIPTION: Record<MoodId, string> = {
  overwhelmed: 'Start with guided breathing — calms an overwhelmed nervous system quickly.',
  exhausted: 'Start with a body scan — gentle, low-effort, and restorative.',
  angry: 'Start with the STOP skill — pause before the next step.',
  scared: 'Start with safe place visualization — 90 seconds of steadiness.',
  sad: 'Start with name it to tame it — labeling sadness with specificity helps.',
  disconnected: 'Start with a body scan — reconnect with your physical self.',
  numb: 'Start with the feelings wheel — explore when you’re unsure.',
  hopeful: 'Start with micro-journaling — capture and anchor hope.',
  happy: 'Start with micro-journaling — savoring extends the good moments.',
  calm: 'Start with a body scan — deepen body awareness from a calm baseline.',
}

/** “Suggested Exercises” on the wellness page (4 per mood) */
export const MOOD_SUGGESTED_EXERCISES: Record<MoodId, WellnessToolId[]> = {
  overwhelmed: ['breathing', 'grounding', 'micro-journal', 'today-nudge'],
  exhausted: ['body-scan', 'breathing', 'night-reset', 'today-nudge'],
  angry: ['stop-skill', 'physical-regulation', 'reframes', 'micro-journal'],
  scared: ['safe-place', 'breathing', 'grounding', 'reframes'],
  sad: ['name-it', 'safe-place', 'micro-journal', 'body-scan'],
  disconnected: ['body-scan', 'name-it', 'grounding', 'today-nudge'],
  numb: ['feelings-wheel', 'name-it', 'body-scan', 'micro-journal'],
  hopeful: ['micro-journal', 'today-nudge', 'reframes', 'breathing'],
  happy: ['micro-journal', 'today-nudge', 'breathing', 'reframes'],
  calm: ['body-scan', 'grounding', 'micro-journal', 'breathing'],
}

/** Primary + secondary tiles in “Tools for your mood” */
export const MOOD_WELLNESS_PRIMARY_SECONDARY: Record<
  MoodId,
  { primary: WellnessToolId; secondary: WellnessToolId }
> = {
  overwhelmed: { primary: 'breathing', secondary: 'grounding' },
  exhausted: { primary: 'body-scan', secondary: 'breathing' },
  angry: { primary: 'stop-skill', secondary: 'physical-regulation' },
  scared: { primary: 'safe-place', secondary: 'breathing' },
  sad: { primary: 'name-it', secondary: 'safe-place' },
  disconnected: { primary: 'body-scan', secondary: 'name-it' },
  numb: { primary: 'feelings-wheel', secondary: 'name-it' },
  hopeful: { primary: 'micro-journal', secondary: 'today-nudge' },
  happy: { primary: 'micro-journal', secondary: 'today-nudge' },
  calm: { primary: 'body-scan', secondary: 'grounding' },
}

/** “Right for you now” card ids per mood (exactly 4 when mood is set) */
export const MOOD_HOME_CARD_ORDER: Record<MoodId, string[]> = {
  overwhelmed: ['chat-support', 'wellness-tools', 'learning-hub', 'feeling-mood'],
  exhausted: ['chat-support', 'wellness-tools', 'learning-hub', 'feeling-mood'],
  angry: ['chat-support', 'wellness-tools', 'visit-questions', 'feeling-mood'],
  scared: ['chat-support', 'wellness-tools', 'learning-hub', 'feeling-mood'],
  sad: ['chat-support', 'wellness-tools', 'learning-hub', 'feeling-mood'],
  disconnected: ['chat-support', 'wellness-tools', 'support-network', 'feeling-mood'],
  numb: ['chat-support', 'wellness-tools', 'learning-hub', 'feeling-mood'],
  hopeful: ['chat-support', 'wellness-tools', 'learning-hub', 'feeling-mood'],
  happy: ['chat-support', 'wellness-tools', 'learning-hub', 'feeling-mood'],
  calm: ['chat-support', 'wellness-tools', 'learning-hub', 'feeling-mood'],
}

export const DEFAULT_HOME_CARD_ORDER = [
  'learning-hub',
  'visit-questions',
  'chat-support',
  'wellness-tools',
] as const

const DEFAULT_SUGGESTED_EXERCISES: WellnessToolId[] = [
  'breathing',
  'grounding',
  'reframes',
  'night-reset',
]

export function wellnessToolPath(toolId: WellnessToolId): string {
  return `/wellness?tool=${toolId}`
}

export function isWellnessToolId(value: string): value is WellnessToolId {
  return (
    value === 'breathing' ||
    value === 'grounding' ||
    value === 'physical-regulation' ||
    value === 'body-scan' ||
    value === 'name-it' ||
    value === 'feelings-wheel' ||
    value === 'micro-journal' ||
    value === 'reframes' ||
    value === 'safe-place' ||
    value === 'stop-skill' ||
    value === 'today-nudge' ||
    value === 'night-reset'
  )
}

export function resolveSuggestedExercisesForMood(moodId: MoodId | null): WellnessToolId[] {
  if (!moodId) return DEFAULT_SUGGESTED_EXERCISES
  return MOOD_SUGGESTED_EXERCISES[moodId]
}
