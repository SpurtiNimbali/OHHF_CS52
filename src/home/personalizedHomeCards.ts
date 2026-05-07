/**
 * Expanded, mood-aware home cards — same pastel palette as the current home screen
 * (mint #A8E6CF, coral #FFAAA5, sky #A8C5E6). Wire into HomeScreen when ready.
 */

import {
  BookOpen,
  Heart,
  MessageCircle,
  Sparkles,
  Stethoscope,
  Users,
  type LucideIcon,
} from 'lucide-react'
import { getChatPromptHint } from '../mood/moodCopy'
import type { MoodId } from '../mood/moodVariants'

/** Tile styles — keep in sync with `ResourcesRightNav` / existing home cards */
export type HomeCardPalette = 'mint' | 'coral' | 'sky'

export const HOME_CARD_PALETTE_CLASSES: Record<
  HomeCardPalette,
  { iconWrapClass: string; iconClass: string }
> = {
  mint: { iconWrapClass: 'bg-[#A8E6CF]', iconClass: 'text-[#2d5f4f]' },
  coral: { iconWrapClass: 'bg-[#FFAAA5]', iconClass: 'text-[#8B3A36]' },
  sky: { iconWrapClass: 'bg-[#A8C5E6]', iconClass: 'text-[#2d4f6f]' },
}

export type HomeCardDefinition = {
  id: string
  title: string
  /** Shown when mood is null or when no override applies */
  descriptionDefault: string
  to: string
  palette: HomeCardPalette
  icon: LucideIcon
  /** If set, description comes from mood-specific copy hook */
  descriptionFromChatHint?: boolean
  /** Optional mood-specific description overrides (full replace for that mood) */
  moodDescriptions?: Partial<Record<MoodId, string>>
}

export const HOME_CARD_CATALOG: HomeCardDefinition[] = [
  {
    id: 'learning-hub',
    icon: BookOpen,
    title: 'Learning & resources',
    descriptionDefault: 'Glossary, education, and tools for your heart health journey.',
    to: '/resources',
    palette: 'mint',
  },
  {
    id: 'visit-questions',
    icon: Heart,
    title: 'Questions for your visit',
    descriptionDefault: 'Save prompts to bring to your cardiologist appointments.',
    to: '/resources?view=questions',
    palette: 'coral',
  },
  {
    id: 'chat-support',
    icon: MessageCircle,
    title: 'Chat prompts & support',
    descriptionDefault:
      'Conversation starters and peer support — open when you want to connect.',
    to: '/resources?view=support',
    palette: 'sky',
    descriptionFromChatHint: true,
  },
  {
    id: 'glossary-quick',
    icon: Stethoscope,
    title: 'Medical glossary',
    descriptionDefault: 'Short, plain-language definitions for heart terms you might hear.',
    to: '/resources?view=glossary',
    palette: 'mint',
  },
  {
    id: 'support-network',
    icon: Users,
    title: 'Find support near you',
    descriptionDefault: 'Groups, programs, and resources tailored to heart families.',
    to: '/resources?view=support',
    palette: 'coral',
  },
  {
    id: 'explore-hub',
    icon: BookOpen,
    title: 'Explore the resource hub',
    descriptionDefault: 'Skim everything in one place — support, questions, and glossary.',
    to: '/resources',
    palette: 'sky',
  },
  {
    id: 'appointment-prep',
    icon: Sparkles,
    title: 'Prep for your appointment',
    descriptionDefault: 'Gather questions and context so you feel ready at the visit.',
    to: '/resources?view=questions',
    palette: 'sky',
    moodDescriptions: {
      hopeful: 'Celebrate what’s going well — then note what you want to ask next.',
      energized: 'Use your energy to lock in one goal to bring up with your team.',
    },
  },
  {
    id: 'mood-check-in',
    icon: Sparkles,
    title: 'Update how you’re feeling',
    descriptionDefault: 'Change your mood tint anytime — it shapes gentle suggestions.',
    to: '/home#mood-check',
    palette: 'mint',
    moodDescriptions: {
      uncertain: 'Naming how you feel is enough for today — adjust your mood whenever.',
      tired: 'It’s okay to switch to a low-energy day — your home screen will match.',
    },
  },
]

const CATALOG_BY_ID = Object.fromEntries(HOME_CARD_CATALOG.map((c) => [c.id, c])) as Record<
  string,
  HomeCardDefinition
>

/** Preference order of card ids per mood; first entries are prioritized when slicing */
const MOOD_CARD_ORDER: Record<'default' | MoodId, string[]> = {
  default: [
    'learning-hub',
    'visit-questions',
    'chat-support',
    'glossary-quick',
    'mood-check-in',
    'support-network',
    'explore-hub',
    'appointment-prep',
  ],
  calm: [
    'learning-hub',
    'glossary-quick',
    'explore-hub',
    'visit-questions',
    'chat-support',
    'mood-check-in',
    'appointment-prep',
    'support-network',
  ],
  hopeful: [
    'visit-questions',
    'appointment-prep',
    'learning-hub',
    'chat-support',
    'glossary-quick',
    'mood-check-in',
    'explore-hub',
    'support-network',
  ],
  uncertain: [
    'chat-support',
    'support-network',
    'glossary-quick',
    'visit-questions',
    'mood-check-in',
    'learning-hub',
    'explore-hub',
    'appointment-prep',
  ],
  tired: [
    'chat-support',
    'mood-check-in',
    'glossary-quick',
    'learning-hub',
    'visit-questions',
    'support-network',
    'explore-hub',
    'appointment-prep',
  ],
  energized: [
    'appointment-prep',
    'visit-questions',
    'explore-hub',
    'chat-support',
    'learning-hub',
    'glossary-quick',
    'support-network',
    'mood-check-in',
  ],
}

export type ResolvedHomeCard = Omit<
  HomeCardDefinition,
  'moodDescriptions' | 'descriptionFromChatHint' | 'palette'
> & {
  description: string
  iconWrapClass: string
  iconClass: string
}

function resolveDescription(card: HomeCardDefinition, moodId: MoodId | null): string {
  if (moodId && card.moodDescriptions?.[moodId]) return card.moodDescriptions[moodId]!
  if (card.descriptionFromChatHint) return getChatPromptHint(moodId)
  return card.descriptionDefault
}

function toResolved(card: HomeCardDefinition, moodId: MoodId | null): ResolvedHomeCard {
  const { moodDescriptions: _m, descriptionFromChatHint: _d, palette, ...rest } = card
  const { iconWrapClass, iconClass } = HOME_CARD_PALETTE_CLASSES[palette]
  return {
    ...rest,
    description: resolveDescription(card, moodId),
    iconWrapClass,
    iconClass,
  }
}

export type PickHomeCardsOptions = {
  /** How many cards to return after ordering & deduping routes (default 5) */
  maxVisible?: number
  /**
   * If true, at most one card per `to` path (keeps the list from feeling repetitive).
   * Default true.
   */
  dedupeRoutes?: boolean
}

/**
 * Ordered, personalized subset of the catalog for the current mood.
 * Safe to call on every render — pure.
 */
export function pickHomeCardsForMood(
  moodId: MoodId | null,
  options: PickHomeCardsOptions = {},
): ResolvedHomeCard[] {
  const maxVisible = options.maxVisible ?? 5
  const dedupeRoutes = options.dedupeRoutes ?? true

  const orderKey: 'default' | MoodId = moodId ?? 'default'
  const idOrder = MOOD_CARD_ORDER[orderKey]

  const seenRoutes = new Set<string>()
  const out: ResolvedHomeCard[] = []

  for (const id of idOrder) {
    const def = CATALOG_BY_ID[id]
    if (!def) continue
    if (dedupeRoutes && seenRoutes.has(def.to)) continue
    if (dedupeRoutes) seenRoutes.add(def.to)
    out.push(toResolved(def, moodId))
    if (out.length >= maxVisible) break
  }

  return out
}
