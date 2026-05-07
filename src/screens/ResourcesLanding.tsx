import type { FC, ReactNode } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { motion } from 'motion/react'
import { Users, MessageCircle, BookOpen } from 'lucide-react'
import BackButton from '../components/BackButton'
import { ResourcesRightNav } from '../components/ResourcesRightNav'
import { useMood, moodShellBackgroundClasses, MoodHeartFill } from '../mood'
import MedicalGlossary from './MedicalGlossary'
import FindSupport from './FindSupport'
import QuestionsForCardiologist from './QuestionsForCardiologist'

const NAVY = '#192b3f'
const LIGHT_BLUE = '#c6d9e5'
const MUTED_BODY = '#acb7a8'
const FONT = 'Inter, -apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif'

type Screen = 'landing' | 'glossary' | 'support' | 'questions'

function screenFromParams(searchParams: URLSearchParams): Screen {
  const v = searchParams.get('view')?.trim().toLowerCase()
  if (v === 'glossary') return 'glossary'
  if (v === 'support') return 'support'
  if (v === 'questions') return 'questions'
  return 'landing'
}

function ResourcesShell({ children }: { children: ReactNode }) {
  const { theme, moodId } = useMood()
  return (
    <div
      className={`min-h-screen flex transition-all duration-700 ${moodShellBackgroundClasses(moodId, theme.pageBg)}`}
      style={{ fontFamily: FONT, color: NAVY }}
    >
      <div className="flex-1 min-w-0 flex flex-col">{children}</div>
      <ResourcesRightNav />
    </div>
  )
}

function SubpageChrome({
  children,
  onBack,
}: {
  children: ReactNode
  onBack: () => void
}) {
  const { theme } = useMood()
  return (
    <ResourcesShell>
      <header
        className="bg-white px-6 sm:px-8 py-5 border-b-4 border-transparent"
        style={{ borderImage: theme.borderGradient }}
      >
        <BackButton onClick={onBack} text="Back to Resources" variant="onLight" />
      </header>
      <div
        className="flex-1 px-6 sm:px-8 py-8 sm:py-10 pb-14 w-full max-w-[960px] mx-auto box-border border border-white/50 bg-white/55 shadow-[0_4px_30px_rgba(25,43,63,0.04)] backdrop-blur-sm transition-all duration-700"
      >
        {children}
      </div>
    </ResourcesShell>
  )
}

const landingCards: {
  Icon: typeof Users
  title: string
  description: string
  view: Exclude<Screen, 'landing'>
  iconWrapClass: string
  iconClass: string
}[] = [
  {
    Icon: Users,
    title: 'Find Support',
    description: 'Connect with community resources and support groups',
    view: 'support',
    iconWrapClass: 'bg-[#c6d9e5]',
    iconClass: 'text-[#192b3f]',
  },
  {
    Icon: MessageCircle,
    title: 'Questions for Your Cardiologist',
    description: 'Important questions and conversation starters for your appointments',
    view: 'questions',
    iconWrapClass: 'bg-[#192b3f]',
    iconClass: 'text-white',
  },
  {
    Icon: BookOpen,
    title: 'Medical Glossary',
    description: 'Understand medical terms related to heart health',
    view: 'glossary',
    iconWrapClass: 'bg-[#577568]',
    iconClass: 'text-white',
  },
]

const ResourcesLanding: FC = () => {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const currentScreen = screenFromParams(searchParams)
  const { theme } = useMood()

  const goLanding = () => setSearchParams({})

  const handleNavigation = (screen: Screen) => {
    if (screen === 'landing') goLanding()
    else setSearchParams({ view: screen })
  }

  if (currentScreen === 'glossary') {
    return (
      <SubpageChrome onBack={goLanding}>
        <MedicalGlossary />
      </SubpageChrome>
    )
  }

  if (currentScreen === 'support') {
    return (
      <SubpageChrome onBack={goLanding}>
        <FindSupport />
      </SubpageChrome>
    )
  }

  if (currentScreen === 'questions') {
    return (
      <SubpageChrome onBack={goLanding}>
        <QuestionsForCardiologist />
      </SubpageChrome>
    )
  }

  return (
    <ResourcesShell>
      <div className="relative flex flex-col flex-1">
        {/* Hero */}
        <section
          className="relative pt-8 pb-28 sm:pb-36 px-4 sm:px-8 text-center shrink-0 border-b-4 border-transparent transition-all duration-700"
          style={{
            backgroundColor: NAVY,
            borderImage: theme.borderGradient,
          }}
        >
          <motion.div
            initial={{ opacity: 0, x: -16 }}
            animate={{ opacity: 1, x: 0 }}
            className="absolute top-6 left-4 sm:left-8 z-10"
          >
            <motion.button
              type="button"
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => navigate('/home')}
              className="inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold text-white border border-white/25 bg-white/10 backdrop-blur-md hover:bg-white/18 transition-colors cursor-pointer"
              style={{ fontFamily: FONT }}
            >
              <span style={{ color: LIGHT_BLUE }} aria-hidden>
                ←
              </span>
              Back to Home
            </motion.button>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.12, duration: 0.45 }}
            className="max-w-2xl mx-auto pt-10 sm:pt-8 px-2"
          >
            <motion.div
              initial={{ scale: 0.85, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.2, type: 'spring', stiffness: 260, damping: 22 }}
              className="inline-flex mb-5"
              aria-hidden
            >
              <MoodHeartFill
                theme={theme}
                size={56}
                viewBox="0 0 24 24"
                pathD="M12 20.5l-1.05-.95C6.4 15.65 3 12.55 3 8.8 3 6.6 4.68 5 6.75 5c1.02 0 2.01.48 2.7 1.23L12 8.9l2.55-2.67A3.47 3.47 0 0117.25 5C19.32 5 21 6.6 21 8.8c0 3.75-3.4 6.85-7.95 10.75L12 20.5z"
                stroke="rgba(255,255,255,0.35)"
                strokeWidth={0.8}
              />
            </motion.div>

            <h1
              className="text-4xl sm:text-5xl md:text-6xl mb-4 text-white tracking-[0.12em] uppercase font-bold leading-tight"
              style={{ fontFamily: "'Bebas Neue', Impact, sans-serif", letterSpacing: '0.14em' }}
            >
              OHHF Resources
            </h1>
            <p
              className="text-base sm:text-lg leading-relaxed text-white/88 max-w-xl mx-auto font-normal"
              style={{ fontFamily: FONT }}
            >
              Access support, information, and tools to help you on your heart health journey.
            </p>
          </motion.div>
        </section>

        {/* Cards */}
        <section className="relative z-[1] flex-1 -mt-16 sm:-mt-20 px-4 sm:px-8 pb-16">
          <div className="max-w-6xl mx-auto">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-7">
              {landingCards.map((item, index) => (
                <motion.button
                  type="button"
                  key={item.view}
                  initial={{ opacity: 0, y: 36 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{
                    delay: 0.25 + index * 0.08,
                    type: 'spring',
                    stiffness: 120,
                    damping: 18,
                  }}
                  whileHover={{ y: -8 }}
                  whileTap={{ scale: 0.99 }}
                  onClick={() => handleNavigation(item.view)}
                  className="text-left rounded-2xl p-7 sm:p-8 bg-white border border-[rgba(25,43,63,0.1)] shadow-[0_4px_24px_rgba(25,43,63,0.06)] hover:shadow-[0_12px_40px_rgba(25,43,63,0.1)] hover:border-[rgba(198,217,229,0.95)] transition-[box-shadow,border-color] duration-300 cursor-pointer group"
                  style={{ fontFamily: FONT }}
                >
                  <motion.div
                    whileHover={{ scale: 1.06 }}
                    transition={{ type: 'spring', stiffness: 400, damping: 20 }}
                    className={`w-14 h-14 sm:w-16 sm:h-16 rounded-xl flex items-center justify-center mb-6 ${item.iconWrapClass}`}
                  >
                    <item.Icon className={`w-7 h-7 sm:w-8 sm:h-8 ${item.iconClass}`} strokeWidth={2} />
                  </motion.div>

                  <h2
                    className="text-[0.95rem] sm:text-base font-bold uppercase tracking-[0.06em] mb-3 leading-snug"
                    style={{ color: NAVY }}
                  >
                    {item.title}
                  </h2>
                  <p className="text-[0.95rem] leading-[1.55] mb-5" style={{ color: MUTED_BODY }}>
                    {item.description}
                  </p>

                  <motion.span
                    className="inline-block text-2xl font-light"
                    style={{ color: LIGHT_BLUE }}
                    initial={{ x: 0 }}
                    whileHover={{ x: 8 }}
                    transition={{ type: 'spring', stiffness: 300, damping: 22 }}
                  >
                    →
                  </motion.span>
                </motion.button>
              ))}
            </div>
          </div>
        </section>
      </div>
    </ResourcesShell>
  )
}

export default ResourcesLanding
