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

/** What the user sends to chat — first-person, directed at the assistant. */
const MOOD_CHAT_PREFILLS: Record<MoodId, string> = {
  happy:
    "I'm feeling really happy right now and want to talk about what's going well.",
  calm:
    "I'm feeling calm right now and want to reflect on what's helping me feel this way.",
  hopeful:
    "I'm feeling hopeful right now and want to explore what I'm looking forward to.",
  overwhelmed:
    "I'm feeling really overwhelmed right now and need help figuring out what to focus on first.",
  exhausted:
    "I'm feeling exhausted from caregiving and want to talk through what's been weighing on me.",
  angry:
    "I'm feeling really angry about our situation right now and need a space to process it.",
  scared:
    "I'm feeling scared today and want help thinking through what's worrying me most.",
  sad:
    "I'm feeling really sad right now and want to explore what I'm carrying.",
  disconnected:
    "I'm feeling disconnected lately and want help finding my way back to feeling present.",
  numb:
    "I'm not sure what I'm feeling right now, and I want to explore it gently.",
}

const CHAT_HINTS: Record<MoodId, string> = {
  happy:
    `Try: “${MOOD_CHAT_PREFILLS.happy}” — open chat when you want to share the good.`,
  calm:
    `Try: “${MOOD_CHAT_PREFILLS.calm}” — open chat when you want to capture this moment.`,
  hopeful:
    `Try: “${MOOD_CHAT_PREFILLS.hopeful}” — open chat when you want to lean into hope.`,
  overwhelmed:
    `Try: “${MOOD_CHAT_PREFILLS.overwhelmed}” — open chat when you need help prioritizing.`,
  exhausted:
    `Try: “${MOOD_CHAT_PREFILLS.exhausted}” — open chat when you need space to name the weight.`,
  angry:
    `Try: “${MOOD_CHAT_PREFILLS.angry}” — open chat when you need room to vent safely.`,
  scared:
    `Try: “${MOOD_CHAT_PREFILLS.scared}” — open chat when fear feels too big to hold alone.`,
  sad:
    `Try: “${MOOD_CHAT_PREFILLS.sad}” — open chat when you need someone to sit with it.`,
  disconnected:
    `Try: “${MOOD_CHAT_PREFILLS.disconnected}” — open chat when you want help reconnecting.`,
  numb:
    `Try: “${MOOD_CHAT_PREFILLS.numb}” — open chat when you're ready to name what’s underneath.`,
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

/** Conversation starter prefilled in chat after a mood check-in. */
export function getMoodChatPrefill(moodId: MoodId): string {
  return MOOD_CHAT_PREFILLS[moodId]
}
