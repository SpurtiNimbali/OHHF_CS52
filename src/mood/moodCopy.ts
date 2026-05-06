import type { MoodId } from './moodVariants'

const MOOD_MESSAGES: Record<MoodId, string> = {
  calm: "Take a deep breath. You're doing great, and it's wonderful to feel at peace.",
  hopeful: 'Your optimism is a powerful tool for healing. Keep looking forward with hope.',
  uncertain:
    "It's okay not to have all the answers. Naming how you feel is already a brave step — support is here.",
  tired: 'Rest is part of healing. Be gentle with yourself and take time to recharge.',
  energized: 'That energy is wonderful! Channel it into activities that support your heart health.',
}

const CHAT_HINTS: Record<MoodId, string> = {
  calm: 'Try: “What relaxes me most on hard days?” Jot it down before you talk with someone.',
  hopeful: 'Try: “What’s one win from this week I want to celebrate?”',
  uncertain: 'Try: “What symptom or worry is heaviest right now?” — share it with your team or a group.',
  tired: 'Try: “Where is my energy lowest, and what rest helps?”',
  energized: 'Try: “What healthy activity do I want to try while I feel up for it?”',
}

const DEFAULT_HINT =
  'Conversation starters and peer support — open when you want to connect.'

export function getMoodMessage(moodId: MoodId): string {
  return MOOD_MESSAGES[moodId]
}

export function getChatPromptHint(moodId: MoodId | null): string {
  if (!moodId) return DEFAULT_HINT
  return CHAT_HINTS[moodId]
}
