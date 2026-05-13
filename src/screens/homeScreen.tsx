import { useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion } from 'motion/react'
import { BookOpen, Heart, MessageCircle, Sparkles } from 'lucide-react'
import { HomeResourceLinkCard } from '../components/home/HomeResourceLinkCard'
import { HomeMoodChipButton } from '../components/home/HomeMoodChipButton'
import { ResourcesRightNav } from '../components/ResourcesRightNav'
import {
  MOOD_VARIANTS,
  type MoodId,
  getChatPromptHint,
  getMoodMessage,
  moodShellBackgroundClasses,
  MoodHeartFill,
  useMood,
} from '../mood'
import { CARDEA_FONT_PRIMARY, CARDEA_MUTED, CARDEA_NAVY } from '../ui/cardeaTokens'

type ResourceCard = {
  id: string
  icon: typeof Heart
  title: string
  description: string
  iconWrapClass: string
  iconClass: string
  to: string
}

const BASE_CARDS: ResourceCard[] = [
  {
    id: 'learn',
    icon: BookOpen,
    title: 'Learning & resources',
    description: 'Glossary, education, and tools for your heart health journey.',
    iconWrapClass: 'bg-[#A8E6CF]',
    iconClass: 'text-[#2d5f4f]',
    to: '/resources',
  },
  {
    id: 'questions',
    icon: Heart,
    title: 'Questions for your visit',
    description: 'Save prompts to bring to your cardiologist appointments.',
    iconWrapClass: 'bg-[#FFAAA5]',
    iconClass: 'text-[#8B3A36]',
    to: '/resources?view=questions',
  },
  {
    id: 'support',
    icon: MessageCircle,
    title: 'Chat prompts & support',
    description: '',
    iconWrapClass: 'bg-[#A8C5E6]',
    iconClass: 'text-[#2d4f6f]',
    to: '/resources?view=support',
  },
]

/** Prioritize Chat prompts when moods tend to benefit from immediate connection copy */
const SUPPORT_FIRST_MOODS: ReadonlySet<MoodId> = new Set([
  'overwhelmed',
  'exhausted',
  'angry',
  'scared',
  'sad',
  'numb',
])

function orderCardsForMood(moodId: MoodId | null): ResourceCard[] {
  const supportHint = getChatPromptHint(moodId)
  const withHints = BASE_CARDS.map((c) =>
    c.id === 'support' ? { ...c, description: supportHint } : c,
  )
  if (!moodId) return withHints
  if (SUPPORT_FIRST_MOODS.has(moodId)) {
    const support = withHints.find((c) => c.id === 'support')!
    const rest = withHints.filter((c) => c.id !== 'support')
    return [support, ...rest]
  }
  if (moodId === 'calm') {
    const learn = withHints.find((c) => c.id === 'learn')!
    const rest = withHints.filter((c) => c.id !== 'learn')
    return [learn, ...rest]
  }
  return withHints
}

export function HomeScreen() {
  const navigate = useNavigate()
  const { moodId, setMoodId, theme, variant } = useMood()

  const personalizedCards = useMemo(() => orderCardsForMood(moodId), [moodId])

  return (
    <div
      className={`min-h-screen flex transition-all duration-700 ${moodShellBackgroundClasses(moodId, theme.pageBg)}`}
      style={{ fontFamily: CARDEA_FONT_PRIMARY, color: CARDEA_NAVY }}
    >
      <div className="flex-1 min-w-0 pb-10">
        <motion.header
          initial={{ opacity: 0, y: -16 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white px-5 sm:px-8 pt-10 pb-8 shadow-sm border-b-4 border-transparent transition-all duration-700"
          style={{ borderImage: theme.borderGradient }}
        >
          <p
            className="text-center text-xs font-bold uppercase tracking-[0.2em] mb-3"
            style={{ color: CARDEA_MUTED }}
          >
            Cardea
          </p>
          <motion.div
            initial={{ scale: 0.92 }}
            animate={{ scale: 1 }}
            className="flex items-center justify-center mb-4"
          >
            <MoodHeartFill
              theme={theme}
              size={52}
              viewBox="0 0 100 100"
              pathD="M50 85C50 85 20 65 20 40C20 25 30 15 40 15C45 15 50 20 50 20C50 20 55 15 60 15C70 15 80 25 80 40C80 65 50 85 50 85Z"
              stroke={theme.heartStroke}
              strokeWidth={2}
            />
          </motion.div>

          <h1
            className="text-3xl sm:text-4xl text-center mb-2 text-[#062A4A]"
            style={{ fontFamily: "'Bebas Neue', sans-serif", letterSpacing: '0.06em' }}
          >
            You&apos;re not alone in this journey
          </h1>
          <p
            className="text-center text-sm sm:text-base max-w-md mx-auto leading-relaxed text-[#3A525A]"
            style={{ fontFamily: CARDEA_FONT_PRIMARY }}
          >
            Taking care of your heart health can feel hard — Cardea is here with you.
          </p>
        </motion.header>

        <div className="px-5 sm:px-8 py-8 space-y-8 max-w-lg mx-auto sm:max-w-2xl">
          <motion.section
            id="mood-check"
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.12 }}
          >
            <h2 className="text-sm font-medium mb-3 text-[#3A525A]" style={{ fontFamily: CARDEA_FONT_PRIMARY }}>
              How are you feeling today?
            </h2>
            <div className="flex flex-wrap gap-2">
              {MOOD_VARIANTS.map((m, index) => (
                <HomeMoodChipButton
                  key={m.id}
                  label={m.label}
                  selected={moodId === m.id}
                  onClick={() => setMoodId(moodId === m.id ? null : m.id)}
                  activeClassNames={`${m.chipBg} ${m.chipText}`}
                  index={index}
                />
              ))}
            </div>
          </motion.section>

          <motion.section
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.22 }}
          >
            <h2 className="text-sm font-medium mb-1 text-[#3A525A]" style={{ fontFamily: CARDEA_FONT_PRIMARY }}>
              Right for you now
            </h2>
            <p className="text-xs mb-4 leading-relaxed text-[#acb7a8]" style={{ fontFamily: CARDEA_FONT_PRIMARY }}>
              {moodId
                ? 'These pick up touches of your mood — tap a card to continue.'
                : 'Choose a mood to tint these cards, or jump in anytime.'}
            </p>
            <div className="space-y-3">
              {personalizedCards.map((resource, index) => (
                <motion.div
                  key={`${resource.id}-${moodId ?? 'default'}`}
                  layout
                  initial={{ opacity: 0, x: -12 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.28 + index * 0.06 }}
                  whileHover={{ x: 4 }}
                  className="will-change-transform"
                >
                  <HomeResourceLinkCard
                    to={resource.to}
                    Icon={resource.icon}
                    title={resource.title}
                    description={resource.description}
                    iconWrapClass={resource.iconWrapClass}
                    iconClass={resource.iconClass}
                  />
                </motion.div>
              ))}
            </div>
          </motion.section>

          <motion.section
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.45 }}
            className={`rounded-2xl p-6 shadow-md relative overflow-hidden transition-all duration-700 ${theme.reminderBg}`}
          >
            <div className="flex items-start gap-3 relative z-10">
              <Sparkles className="w-6 h-6 shrink-0" style={{ color: theme.heartStroke }} strokeWidth={2} />
              <div>
                <h3 className="font-semibold text-[#062A4A] text-sm mb-1" style={{ fontFamily: CARDEA_FONT_PRIMARY }}>
                  {variant ? `Feeling ${variant.label}` : 'Today’s gentle reminder'}
                </h3>
                <p className="text-sm leading-relaxed text-[#3A525A]" style={{ fontFamily: CARDEA_FONT_PRIMARY }}>
                  {moodId
                    ? getMoodMessage(moodId)
                    : "It's okay to take things one step at a time. Small progress is still progress on your heart health journey."}
                </p>
              </div>
            </div>
          </motion.section>

          <p className="text-center text-xs" style={{ color: CARDEA_MUTED }}>
            <Link to="/" className="underline underline-offset-2 hover:text-[#192b3f] transition-colors">
              Sign out flow
            </Link>
            {' · '}
            <button
              type="button"
              onClick={() => navigate('/resources')}
              className="underline underline-offset-2 hover:text-[#192b3f] transition-colors bg-transparent border-0 p-0 cursor-pointer font-inherit text-inherit"
            >
              All resources
            </button>
          </p>
        </div>
      </div>

      <ResourcesRightNav />
    </div>
  )
}
