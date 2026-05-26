/**
 * Mood → home cards & wellness tools (CS 51/52 team doc).
 * Single source of truth for personalized surfaces.
 */

import type { MoodId } from './moodVariants'
import {
  buildToolRoute,
  isLiveWellnessToolId,
  type WellnessToolId,
} from '../lib/wellnessToolRegistry'

/** Primary wellness tool surfaced on the home “Wellness tools” card */
export const MOOD_PRIMARY_WELLNESS_TOOL: Record<MoodId, WellnessToolId> = {
  overwhelmed: 'breathing',
  exhausted: 'physical-regulation',
  angry: 'physical-regulation',
  scared: 'safe-place',
  sad: 'name-it',
  disconnected: 'today-nudge',
  numb: 'name-it',
  hopeful: 'micro-journal',
  happy: 'micro-journal',
  calm: 'grounding',
}

/** Home “Wellness tools” card copy — names the primary exercise */
export const MOOD_WELLNESS_HOME_DESCRIPTION: Record<MoodId, string> = {
  overwhelmed: 'Start with guided breathing — calms an overwhelmed nervous system quickly.',
  exhausted: 'Start with physical regulation — cold, movement, or a body scan can steady your system.',
  angry: 'Start with physical regulation — move some of the charge through your body first.',
  scared: 'Start with Safe Place Visualization — 90 seconds of steadiness.',
  sad: 'Start with Name It to Tame It — labeling sadness with specificity helps.',
  disconnected: "Start with Today's Nudge — one small cue can help you reconnect.",
  numb: 'Start with Name It to Tame It — a few words can create some signal.',
  hopeful: 'Start with micro-journaling — capture and anchor hope.',
  happy: 'Start with micro-journaling — savoring extends the good moments.',
  calm: 'Start with grounding — stay anchored in what already feels steady.',
}

/** “Suggested Exercises” on the wellness page (4 per mood) */
export const MOOD_SUGGESTED_EXERCISES: Record<MoodId, WellnessToolId[]> = {
  overwhelmed: ['breathing', 'grounding', 'micro-journal', 'today-nudge'],
  exhausted: ['physical-regulation', 'breathing', 'micro-journal', 'today-nudge'],
  angry: ['physical-regulation', 'reframes', 'grounding', 'micro-journal'],
  scared: ['safe-place', 'breathing', 'grounding', 'reframes'],
  sad: ['name-it', 'safe-place', 'micro-journal', 'reframes'],
  disconnected: ['today-nudge', 'micro-journal', 'grounding', 'name-it'],
  numb: ['name-it', 'physical-regulation', 'grounding', 'micro-journal'],
  hopeful: ['micro-journal', 'today-nudge', 'reframes', 'breathing'],
  happy: ['micro-journal', 'today-nudge', 'breathing', 'reframes'],
  calm: ['grounding', 'breathing', 'micro-journal', 'safe-place'],
}

/** Primary + secondary tiles in “Tools for your mood” */
export const MOOD_WELLNESS_PRIMARY_SECONDARY: Record<
  MoodId,
  { primary: WellnessToolId; secondary: WellnessToolId }
> = {
  overwhelmed: { primary: 'breathing', secondary: 'grounding' },
  exhausted: { primary: 'physical-regulation', secondary: 'breathing' },
  angry: { primary: 'physical-regulation', secondary: 'reframes' },
  scared: { primary: 'safe-place', secondary: 'breathing' },
  sad: { primary: 'name-it', secondary: 'safe-place' },
  disconnected: { primary: 'today-nudge', secondary: 'micro-journal' },
  numb: { primary: 'name-it', secondary: 'physical-regulation' },
  hopeful: { primary: 'micro-journal', secondary: 'today-nudge' },
  happy: { primary: 'micro-journal', secondary: 'today-nudge' },
  calm: { primary: 'grounding', secondary: 'breathing' },
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
  'micro-journal',
]

export function wellnessToolPath(toolId: WellnessToolId): string {
  return buildToolRoute(toolId)
}

export function isWellnessToolId(value: string): value is WellnessToolId {
  return isLiveWellnessToolId(value)
}

export function resolveSuggestedExercisesForMood(moodId: MoodId | null): WellnessToolId[] {
  if (!moodId) return DEFAULT_SUGGESTED_EXERCISES
  return MOOD_SUGGESTED_EXERCISES[moodId]
}
