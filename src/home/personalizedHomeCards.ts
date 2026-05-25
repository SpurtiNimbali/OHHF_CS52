/**
 * Mood-aware home cards — CS 51/52 team doc + existing catalog.
 */

import {
  BookOpen,
  CircleHelp,
  Heart,
  MessageCircle,
  Sparkles,
  Stethoscope,
  Users,
  Wind,
  type LucideIcon,
} from 'lucide-react'
import { getChatPromptHint, getMoodMessage } from '../mood/moodCopy'
import {
  DEFAULT_HOME_CARD_ORDER,
  MOOD_HOME_CARD_ORDER,
  MOOD_PRIMARY_WELLNESS_TOOL,
  MOOD_WELLNESS_HOME_DESCRIPTION,
  wellnessToolPath,
} from '../mood/moodRecommendations'
import { moodVariantById, type MoodId } from '../mood/moodVariants'

/** Tile styles — keep in sync with `ResourcesRightNav` / existing home cards */
export type HomeCardPalette = 'mint' | 'coral' | 'sky' | 'lavender'

export const HOME_CARD_PALETTE_CLASSES: Record<
  HomeCardPalette,
  { iconWrapClass: string; iconClass: string }
> = {
  mint: { iconWrapClass: 'bg-[#A8E6CF]', iconClass: 'text-[#2d5f4f]' },
  coral: { iconWrapClass: 'bg-[#FFAAA5]', iconClass: 'text-[#8B3A36]' },
  sky: { iconWrapClass: 'bg-[#A8C5E6]', iconClass: 'text-[#2d4f6f]' },
  lavender: { iconWrapClass: 'bg-[#D5AAFF]', iconClass: 'text-[#5B3A70]' },
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
  /** Title becomes “Feeling {mood label}” when a mood is selected */
  titleFromMoodLabel?: boolean
  /** Description comes from getMoodMessage when a mood is selected */
  descriptionFromMoodMessage?: boolean
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
    icon: CircleHelp,
    title: 'Questions for your visit',
    descriptionDefault: 'Save prompts to bring to your healthcare appointments.',
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
    id: 'wellness-tools',
    icon: Wind,
    title: 'Wellness tools',
    descriptionDefault: 'Grounding, breathing, journaling, and gentle reset tools.',
    to: '/wellness',
    palette: 'lavender',
  },
  {
    id: 'feeling-mood',
    icon: Sparkles,
    title: 'How you’re feeling',
    descriptionDefault: 'Choose a mood to see a gentle reminder tailored to you.',
    to: '/home#mood-check',
    palette: 'mint',
    titleFromMoodLabel: true,
    descriptionFromMoodMessage: true,
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
  },
  {
    id: 'mood-check-in',
    icon: Sparkles,
    title: 'Update how you’re feeling',
    descriptionDefault: 'Change your mood tint anytime — it shapes gentle suggestions.',
    to: '/home#mood-check',
    palette: 'mint',
  },
]

const CATALOG_BY_ID = Object.fromEntries(HOME_CARD_CATALOG.map((c) => [c.id, c])) as Record<
  string,
  HomeCardDefinition
>

export type ResolvedHomeCard = Omit<
  HomeCardDefinition,
  'moodDescriptions' | 'descriptionFromChatHint' | 'titleFromMoodLabel' | 'descriptionFromMoodMessage' | 'palette'
> & {
  description: string
  iconWrapClass: string
  iconClass: string
}

function resolveTitle(card: HomeCardDefinition, moodId: MoodId | null): string {
  if (moodId && card.titleFromMoodLabel) {
    return `Feeling ${moodVariantById(moodId).label}`
  }
  return card.title
}

function resolveDescription(card: HomeCardDefinition, moodId: MoodId | null): string {
  if (moodId && card.descriptionFromMoodMessage) return getMoodMessage(moodId)
  if (moodId && card.id === 'wellness-tools') return MOOD_WELLNESS_HOME_DESCRIPTION[moodId]
  if (moodId && card.moodDescriptions?.[moodId]) return card.moodDescriptions[moodId]!
  if (card.descriptionFromChatHint) return getChatPromptHint(moodId)
  return card.descriptionDefault
}

function resolveTo(card: HomeCardDefinition, moodId: MoodId | null): string {
  if (moodId && card.id === 'wellness-tools') {
    return wellnessToolPath(MOOD_PRIMARY_WELLNESS_TOOL[moodId])
  }
  return card.to
}

function toResolved(card: HomeCardDefinition, moodId: MoodId | null): ResolvedHomeCard {
  const {
    moodDescriptions: _m,
    descriptionFromChatHint: _d,
    titleFromMoodLabel: _t,
    descriptionFromMoodMessage: _f,
    palette,
    title,
    to,
    ...rest
  } = card
  const { iconWrapClass, iconClass } = HOME_CARD_PALETTE_CLASSES[palette]
  return {
    ...rest,
    title: resolveTitle(card, moodId),
    to: resolveTo(card, moodId),
    description: resolveDescription(card, moodId),
    iconWrapClass,
    iconClass,
  }
}

export type PickHomeCardsOptions = {
  /** How many cards to return (default 4) */
  maxVisible?: number
}

/**
 * Ordered, personalized home cards for the current mood.
 * With a mood selected: 4 cards from the team doc (chat → wellness → resource → feeling).
 */
export function pickHomeCardsForMood(
  moodId: MoodId | null,
  options: PickHomeCardsOptions = {},
): ResolvedHomeCard[] {
  const maxVisible = options.maxVisible ?? 4
  const idOrder = moodId ? MOOD_HOME_CARD_ORDER[moodId] : [...DEFAULT_HOME_CARD_ORDER]
  const out: ResolvedHomeCard[] = []

  for (const id of idOrder) {
    const def = CATALOG_BY_ID[id]
    if (!def) continue
    out.push(toResolved(def, moodId))
    if (out.length >= maxVisible) break
  }

  return out
}
