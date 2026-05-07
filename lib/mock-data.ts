// ── Types ─────────────────────────────────────────────────────────────────────

export type MessageRole = 'user' | 'assistant'

export interface CitationResource {
  id: string
  title: string
  description: string
  url?: string
  type: 'article' | 'hotline' | 'exercise' | 'tool'
}

export interface Message {
  id: string
  role: MessageRole
  content: string
  timestamp: Date
  citations?: CitationResource[]
}

export interface PromptChip {
  id: string
  label: string
}

export type FeatureIconKey = 'message' | 'heart' | 'shield'

export interface FeatureCard {
  id: string
  icon: FeatureIconKey
  title: string
  description: string
}

// ── Prompt chips ──────────────────────────────────────────────────────────────

export const PROMPT_CHIPS: PromptChip[] = [
  { id: '1', label: "I'm feeling anxious" },
  { id: '2', label: 'Help me calm down' },
  { id: '3', label: 'Breathing exercises' },
  { id: '4', label: 'I feel overwhelmed' },
  { id: '5', label: 'Sleep support' },
]

// ── Welcome screen feature cards ──────────────────────────────────────────────

export const FEATURE_CARDS: FeatureCard[] = [
  {
    id: 'confidential',
    icon: 'message',
    title: 'Confidential',
    description: 'Your conversations are private and secure',
  },
  {
    id: 'compassionate',
    icon: 'heart',
    title: 'Compassionate',
    description: 'Non-judgmental support whenever you need it',
  },
  {
    id: 'resource-rich',
    icon: 'shield',
    title: 'Resource-Rich',
    description: 'Access to helpful tools and professional resources',
  },
]

// ── Mock messages (empty array → shows welcome state) ─────────────────────────

export const MOCK_MESSAGES: Message[] = []

// ── Sample citation resources ─────────────────────────────────────────────────

export const MOCK_CITATIONS: CitationResource[] = [
  {
    id: '1',
    title: '4-7-8 Breathing Technique',
    description: 'Inhale 4s, hold 7s, exhale 8s — reduces anxiety in minutes',
    type: 'exercise',
  },
  {
    id: '2',
    title: 'Crisis Text Line',
    description: 'Text HOME to 741741 — free, confidential support 24/7',
    url: 'https://crisistextline.org',
    type: 'hotline',
  },
  {
    id: '3',
    title: 'NAMI Helpline',
    description: 'Call 1-800-950-6264 for mental health information and referrals',
    url: 'https://nami.org/help',
    type: 'hotline',
  },
]
