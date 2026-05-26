/**
 * Crisis keyword / phrase detection for chat and crisis-check API.
 * Tier A patterns auto-trigger the crisis response in companion chat.
 *
 * Phrases: literal substrings (escaped automatically).
 * Regex fragments: flexible patterns (word boundaries, optional words).
 */

export interface CrisisResource {
  name: string
  number: string
  description: string
  available: string
}

/** Multi-word phrases (matched after normalization). */
export const CRISIS_PHRASES = [
  // suicide / wanting to die
  'better off dead',
  'do not want to be alive',
  'do not want to be here',
  'do not want to be here anymore',
  'do not want to live',
  'do not want to wake up',
  'don\'t want to be alive',
  'don\'t want to be here',
  'don\'t want to be here anymore',
  'don\'t want to live',
  'don\'t want to wake up',
  'don\'t think i will survive',
  'don\'t think i\'ll survive',
  'do not think i\'ll survive',
  'end it all',
  'end my life',
  'ending my life',
  'everyone would be better without me',
  'going to die today',
  'going to die tonight',
  'going to kill myself',
  'hang myself',
  'hanging myself',
  'hope i do not wake up',
  'hope i don\'t wake up',
  'i am done with everything',
  'i am going to die',
  'i am going to kill myself',
  'i am self-harming',
  'i cannot go on like this',
  'i can\'t go on like this',
  'i could hurt someone',
  'i do not want to wake up',
  'i don\'t want to wake up',
  'i hope i do not wake up',
  'i hope i don\'t wake up',
  'i might hurt someone',
  'i should kill myself',
  'i think he is dying',
  'i think i am dying',
  'i think i\'m dying',
  'i think my baby is dying',
  'i think my child is dying',
  'i think she is dying',
  'i want to disappear forever',
  'i want to kill myself',
  'i\'m afraid i might hurt someone',
  'i\'m done with everything',
  'i\'m going to die',
  'i\'m going to kill myself',
  'i\'m self-harming',
  'kill myself',
  'killing myself',
  'my baby is going to die',
  'my child is going to die',
  'my family would be better without me',
  'my life is at risk',
  'my life is in danger',
  'no reason to live',
  'not going to survive',
  'not worth living',
  'overdose on purpose',
  'plan to kill myself',
  'planning to kill myself',
  'ready to end it',
  'suicide plan',
  'take my life',
  'take my own life',
  'there is no reason to live',
  'there is no way out',
  'think i am going to die',
  'think i\'m going to die',
  'thinking about killing myself',
  'thinking of killing myself',
  'want to die',
  'wanted to die',
  'want to hurt someone',
  'wish i was dead',
  'wish i were dead',
  'won\'t survive',
  // self-harm
  'burning myself on purpose',
  'cut myself',
  'cut myself again',
  'cutting myself',
  'harm myself',
  'harming myself',
  'hurt myself',
  'hurt myself on purpose',
  'hurting myself',
  'think about hurting myself',
  'thinking about hurting myself',
  'thinking about self harm',
  'thinking about self-harm',
  'thought about hurting myself',
  'thoughts of hurting myself',
  'want to cut myself',
  'want to hurt myself',
  // harm others
  'afraid i might hurt someone',
  'going to hurt someone',
  'harm others',
  'harming others',
  'hurt others',
  'hurting others',
  'thinking about hurting someone',
  'thinking of hurting someone',
  // life threat (self / caregiver)
  'afraid for my childs life',
  'afraid for my life',
  'afraid for my child\'s life',
  'afraid i am going to die',
  'afraid i\'m going to die',
  'afraid my baby will die',
  'afraid my child will die',
  'afraid of dying',
  'cannot keep my child safe',
  'can\'t keep my child safe',
  'fear for my life',
  'frightened for my life',
  'life is in danger',
  'scared for my childs life',
  'scared for my child\'s life',
  'scared for my life',
  'scared i am going to die',
  'scared i\'m going to die',
  'scared my baby will die',
  'scared my child will die',
  'scared of dying',
  'terrified for my life',
  'terrified of dying',
  'threat to life',
  'threat to my life',
  'threatened my life',
  // acute hopelessness / overwhelm
  'cannot do this anymore',
  'can\'t do this anymore',
  'i have nothing left',
]

/** Regex fragments (no extra escaping — use String.raw). */
export const CRISIS_REGEX_FRAGMENTS = [
  String.raw`\bsuicid\w*\b`,
  String.raw`\bkill(?:ing)?\s+myself\b`,
  String.raw`\bend\s+(?:my\s+life|it\s+all)\b`,
  String.raw`\b(?:want|wanted|wanna|planning|plan)\s+to\s+die\b`,
  String.raw`\b(?:do\s+not|don'?t)\s+want\s+to\s+(?:live|be\s+here|be\s+alive|wake\s+up)\b`,
  String.raw`\b(?:wish|wished)\s+i\s+(?:was|were)\s+dead\b`,
  String.raw`\bbetter\s+off\s+dead\b`,
  String.raw`\bno\s+reason\s+to\s+live\b`,
  String.raw`\b(?:hurt|harm|cut|burn)\s+myself\b`,
  String.raw`\bself[\s-]?harm(?:ing)?\b(?! screening)`,
  String.raw`\b(?:want|wanted|thinking\s+(?:about|of)|plan(?:ning)?)\b.{0,25}\b(?:hurt|harm|kill)\s+someone\b`,
  String.raw`\b(?:i\s+think|i\s+feel|afraid|scared)\b.{0,25}\b(?:i\s+am|i'm|my\s+(?:baby|child)\s+is|he\s+is|she\s+is)\b.{0,15}\b(?:dying|going\s+to\s+die)\b`,
  String.raw`\b(?:my\s+(?:baby|child))\s+is\s+going\s+to\s+die\b`,
  String.raw`\b(?:afraid|scared)\b.{0,20}\b(?:my\s+(?:baby|child))\b.{0,15}\b(?:die|dying)\b`,
  String.raw`\b(?:there\s+is\s+no\s+way\s+out|nothing\s+left\s+for\s+me)\b`,
  String.raw`\b(?:everyone|my\s+family)\s+would\s+be\s+better\s+without\s+me\b`,
  String.raw`\bhope\s+i\s+(?:do\s+not|don'?t)\s+wake\s+up\b`,
  String.raw`\b(?:can(?:not|'t)|i\s+(?:can(?:not|'t)))\s+do\s+this\s+anymore\b`,
  String.raw`\b(?:scared|afraid|terrified|frightened)\s+(?:for|of)\s+(?:my\s+)?(?:life|child'?s?\s+life)\b`,
  String.raw`\b(?:scared|afraid|terrified|frightened)\b.{0,30}\b(?:i'?m|i\s+am)\s+going\s+to\s+die\b`,
  String.raw`\b(threat|threatened)\w*\s+to\s+(?:my\s+)?life\b`,
  String.raw`\b(?:my\s+)?life\s+is\s+(?:in\s+)?danger\b`,
  String.raw`\b(?:my\s+)?life\s+is\s+at\s+risk\b`,
  String.raw`\bdon'?t\s+think\s+i'?ll\s+(?:survive|make\s+it)\b`,
  String.raw`\bnot\s+going\s+to\s+(?:survive|make\s+it)\b`,
  String.raw`\b(?:can(?:not|'t))\s+keep\s+my\s+child\s+safe\b`,
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
