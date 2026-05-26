import type { MoodId } from './moodVariants'

/** “Feeling …” taglines — home card 4 & reminder panel */
const MOOD_MESSAGES: Record<MoodId, string> = {
  happy: 'Good moments deserve to be noticed — let’s help this one stay.',
  calm: 'Calm is hard-won. Take a breath and let yourself have it.',
  hopeful: 'Hope is a practice. Let’s help it take root.',
  overwhelmed: 'So much on your plate — let’s find one small thing to release.',
  exhausted: 'Tired doesn’t mean failing. It means you’ve been showing up.',
  angry: 'Anger often means something matters deeply to you, and that’s not wrong.',
  scared: 'Fear often shows up beside love for your heart. You’re not alone with it.',
  sad: 'Grief is love with nowhere to go — it deserves to be witnessed.',
  disconnected:
    'Disconnection is protection — your system did what it needed to. We can find our way back.',
  numb: 'Not knowing what you feel is a feeling too — let’s explore it gently.',
}

const CHAT_HINTS: Record<MoodId, string> = {
  happy:
    'Try: “What made today feel lighter, and how can I hold onto that?” — share it when you chat.',
  calm:
    'Try: “What helped me get to this calm place, and what do I want to remember about it?” — jot it down before you talk with someone.',
  hopeful:
    'Try: “What’s one thing I’m looking forward to, even if it’s small?” — celebrate it when you chat.',
  overwhelmed:
    'Try: “What’s one thing I can set down today, even temporarily?” — say it clearly to someone you trust.',
  exhausted:
    'Try: “What has caregiving cost me lately that I haven’t named out loud?” — honesty counts as clarity.',
  angry:
    'Try: “What feels most unfair about this situation right now?” — share it with care.',
  scared:
    'Try: “What symptom or uncertainty scares me most today?” — share it with care.',
  sad:
    'Try: “What loss or grief am I carrying right now that I haven’t had space to feel?” — even a tiny comfort counts.',
  disconnected:
    'Try: “When did I last feel present with someone I love, and what was different then?” — that’s enough to open a conversation.',
  numb:
    'Try: “If I had to guess at one word for what I’m feeling underneath ‘unsure,’ what might it be?” — honesty like that counts as clarity.',
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

/** Conversation starter for chat prefill (quoted line from mood hint, when present). */
export function getMoodChatPrefill(moodId: MoodId): string {
  const hint = CHAT_HINTS[moodId]
  const quoted = hint.match(/[“"]([^”"]+)[”"]/)
  if (quoted?.[1]) return quoted[1]
  const stripped = hint.replace(/^Try:\s*/i, '').split(' — ')[0]?.trim()
  return stripped || hint
}
