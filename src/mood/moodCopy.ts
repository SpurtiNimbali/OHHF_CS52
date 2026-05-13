import type { MoodId } from './moodVariants'

const MOOD_MESSAGES: Record<MoodId, string> = {
  happy:
    'That lightness matters — ride the wave kindly and savor what feels good.',
  calm: "Take a deep breath. You're doing great, and it's wonderful to feel at peace.",
  hopeful: 'Your optimism is a powerful tool for healing. Keep looking forward with hope.',
  overwhelmed:
    'When everything feels loud, small steps still count — you deserve gentleness.',
  exhausted: 'Rest is part of healing. Be gentle with yourself and take time to recharge.',
  angry: 'Your frustration makes sense — it’s okay to feel it without judging yourself.',
  scared: 'Fear often shows up beside love for your heart — you’re not alone with it.',
  sad: 'It’s alright to carry a heavy heart today — tenderness toward yourself counts.',
  disconnected:
    'Sometimes we feel distant — naming it is honest, and you still belong here.',
  numb: "Not knowing how you feel is its own truth — there's no rush to sort it.",
}

const CHAT_HINTS: Record<MoodId, string> = {
  happy:
    'Try: “What’s one thing that went better than expected this week?” — share it when you chat.',
  calm: 'Try: “What relaxes me most on hard days?” Jot it down before you talk with someone.',
  hopeful: 'Try: “What’s one win from this week I want to celebrate?”',
  overwhelmed:
    'Try: “What is the loudest worry right now?” — say it clearly to someone you trust.',
  exhausted: 'Try: “Where is my energy lowest, and what rest helps?”',
  angry: 'Try: “What made me upset, and what do I wish my team understood?”',
  scared: 'Try: “What symptom or uncertainty scares me most today?” — share it with care.',
  sad: 'Try: “What would feel a little softer today?” — even a tiny comfort counts.',
  disconnected:
    'Try: “I feel a bit unplugged lately” — that’s enough to open a conversation.',
  numb: 'Try: “I’m not sure what I’m feeling” — honesty like that counts as clarity.',
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
