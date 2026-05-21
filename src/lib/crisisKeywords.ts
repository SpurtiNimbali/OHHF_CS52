/**
 * Crisis keyword / phrase detection for chat and crisis-check API.
 * Tier A patterns auto-trigger the crisis response in companion chat.
 */

export interface CrisisResource {
  name: string
  number: string
  description: string
  available: string
}

/** Multi-word phrases (matched after normalization). */
export const CRISIS_PHRASES = [
  'kill myself',
  'killing myself',
  'take my life',
  'take my own life',
  'end my life',
  'ending my life',
  'end it all',
  'want to die',
  'wanting to die',
  'wish i was dead',
  'wish i were dead',
  'better off dead',
  'not worth living',
  'no reason to live',
  "don't want to live",
  'do not want to live',
  "don't want to be alive",
  'do not want to be alive',
  "don't want to be here",
  'do not want to be here',
  "don't want to be here anymore",
  'do not want to be here anymore',
  'hurt myself',
  'hurting myself',
  'harm myself',
  'harming myself',
  'think about hurting myself',
  'thinking about hurting myself',
  'thought about hurting myself',
  'thoughts of hurting myself',
  'self harm',
  'self-harm',
  'hang myself',
  'hanging myself',
  'cut myself',
  'cutting myself',
  'overdose on purpose',
  'going to kill myself',
  'plan to kill myself',
  'planning to kill myself',
  'suicide plan',
  'hurt others',
  'hurting others',
  'harm others',
  'harming others',
  'want to hurt someone',
  'going to hurt someone',
]

/** Regex fragments (no extra escaping — already regex). */
export const CRISIS_REGEX_FRAGMENTS = [
  String.raw`\bsuicid\w*\b`,
  String.raw`\bself[\s-]?harm\b`,
  String.raw`\bdon'?t\s+want\s+to\s+(live|be\s+here|be\s+alive)\b`,
  String.raw`\bdo\s+not\s+want\s+to\s+(live|be\s+here|be\s+alive)\b`,
]

function escapeRegexLiteral(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export const CRISIS_REGEX = new RegExp(
  [...CRISIS_PHRASES.map(escapeRegexLiteral), ...CRISIS_REGEX_FRAGMENTS].join('|'),
  'i',
)

/** @deprecated Use CRISIS_PHRASES — kept for docs / gradual migration. */
export const CRISIS_KEYWORDS = CRISIS_PHRASES

export function normalizeForCrisisCheck(text: string): string {
  return text
    .toLowerCase()
    .replace(/[''`]/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
}

export function detectCrisisKeywords(text: string): boolean {
  if (!text?.trim()) return false
  return CRISIS_REGEX.test(normalizeForCrisisCheck(text))
}

export const CRISIS_RESOURCES: CrisisResource[] = [
  {
    name: '988 Suicide & Crisis Lifeline',
    number: '988',
    description: 'Call or text 988 to reach the Suicide and Crisis Lifeline',
    available: 'Available 24/7',
  },
  {
    name: 'Crisis Text Line',
    number: 'Text HOME to 741741',
    description: 'Text HOME to reach trained crisis counselors',
    available: 'Available 24/7',
  },
  {
    name: 'National Domestic Violence Hotline',
    number: '1-800-799-7233',
    description: "If you're experiencing domestic violence",
    available: 'Available 24/7',
  },
  {
    name: 'SAMHSA National Helpline',
    number: '1-800-662-4357',
    description: 'Free, confidential support for substance abuse and mental health',
    available: 'Available 24/7',
  },
  {
    name: 'International Association for Suicide Prevention',
    number: 'https://www.iasp.info/resources/Crisis_Centres/',
    description: 'Find crisis centers by country',
    available: 'Worldwide resources',
  },
]
