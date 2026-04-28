/**
 * Crisis keywords and phrases for detecting when users may be in crisis
 * These are monitored server-side to trigger crisis support resources
 */

export const CRISIS_KEYWORDS = [
  // Suicidal ideation
  'suicide',
  'suicidal',
  'kill myself',
  'take my life',
  'end my life',
  'hurt myself',
  'self harm',
  'self-harm',
  'cutting',
  'overdose',
  'jump',
  'hang myself',
  
  // Severe depression/hopelessness
  'no point',
  'no reason to live',
  'meaningless',
  'hopeless',
  'worthless',
  'burden',
  'everyone would be better off',
  'i give up',
  
  // Acute mental health crisis
  'panic attack',
  'breakdown',
  'losing my mind',
  'going insane',
  'can\'t cope',
  'emergency',
  
  // Self-injury indicators
  'hurting myself',
  'slashing',
  'burning myself',
  'punching',
  
  // Abuse indicators (suggesting urgent safety concern)
  'domestic violence',
  'abuse',
  'attacked',
  'assaulted',
  'hit me',
  'abusive',
  
  // Child safety
  'abuse child',
  'hurt child',
  'harm child',
]

export const CRISIS_REGEX = new RegExp(
  CRISIS_KEYWORDS
    .map(keyword => keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .join('|'),
  'gi'
)

export function detectCrisisKeywords(text: string): boolean {
  if (!text) return false
  return CRISIS_REGEX.test(text)
}

export interface CrisisResource {
  name: string
  number: string
  description: string
  available: string
}

export const CRISIS_RESOURCES: CrisisResource[] = [
  {
    name: '988 Suicide & Crisis Lifeline',
    number: '988',
    description: 'Call or text 988 to reach the Suicide and Crisis Lifeline',
    available: 'Available 24/7'
  },
  {
    name: 'Crisis Text Line',
    number: 'Text HOME to 741741',
    description: 'Text HOME to reach trained crisis counselors',
    available: 'Available 24/7'
  },
  {
    name: 'National Domestic Violence Hotline',
    number: '1-800-799-7233',
    description: 'If you\'re experiencing domestic violence',
    available: 'Available 24/7'
  },
  {
    name: 'SAMHSA National Helpline',
    number: '1-800-662-4357',
    description: 'Free, confidential support for substance abuse and mental health',
    available: 'Available 24/7'
  },
  {
    name: 'International Association for Suicide Prevention',
    number: 'https://www.iasp.info/resources/Crisis_Centres/',
    description: 'Find crisis centers by country',
    available: 'Worldwide resources'
  }
]
