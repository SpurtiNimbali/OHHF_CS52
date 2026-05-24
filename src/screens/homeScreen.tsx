import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion } from 'motion/react'
import { Heart, Sparkles } from 'lucide-react'
import { HomeResourceLinkCard } from '../components/home/HomeResourceLinkCard'
import { HomeFeelingReminderCard } from '../components/home/HomeFeelingReminderCard'
import { HomeMoodChipButton } from '../components/home/HomeMoodChipButton'
import { ResourcesRightNav } from '../components/ResourcesRightNav'
import { pickHomeCardsForMood } from '../home'
import {
  MOOD_VARIANTS,
  type MoodId,
  getMoodChatPrefill,
  moodShellBackgroundClasses,
  MoodHeartFill,
  useMood,
} from '../mood'
import {
  ensureMoodEntryForChat,
  insertMoodEntry,
  markMoodCheckInSaved,
  clearMoodCheckInSession,
} from '../lib/moodEntries'
import { CARDEA_FONT_PRIMARY, CARDEA_MUTED, CARDEA_NAVY } from '../ui/cardeaTokens'

const WELLNESS_MOOD_LOG_KEY = 'cardea-wellness-mood-log'

type HomeMoodLogEntry = {
  id: string
  date: string
  emotion: MoodId
  note?: string
}

function makeMoodLogId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return `home-mood-${crypto.randomUUID()}`
  }
  return `home-mood-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

function appendMoodCheckIn(emotion: MoodId, note: string) {
  try {
    const raw = localStorage.getItem(WELLNESS_MOOD_LOG_KEY)
    const previous = raw ? (JSON.parse(raw) as HomeMoodLogEntry[]) : []
    const next: HomeMoodLogEntry[] = [
      {
        id: makeMoodLogId(),
        date: new Date().toISOString(),
        emotion,
        note: note.trim() || undefined,
      },
      ...previous,
    ].slice(0, 80)
    localStorage.setItem(WELLNESS_MOOD_LOG_KEY, JSON.stringify(next))
  } catch {
    /* ignore local storage failures */
  }
}

export function HomeScreen() {
  const navigate = useNavigate()
  const { moodId, setMoodId, theme } = useMood()
  const [checkInSaved, setCheckInSaved] = useState(false)
  const [checkInError, setCheckInError] = useState<string | null>(null)
  const [showMoodCheckIn, setShowMoodCheckIn] = useState(false)

  const personalizedCards = useMemo(() => pickHomeCardsForMood(moodId), [moodId])

  async function saveMoodCheckIn() {
    if (!moodId) return
    setCheckInError(null)
    appendMoodCheckIn(moodId, '')
    const { entry, error } = await insertMoodEntry(moodId)
    if (error) {
      setCheckInError(error)
      return
    }
    if (entry) markMoodCheckInSaved(moodId, entry.id)
    setCheckInSaved(true)
    window.setTimeout(() => setCheckInSaved(false), 2500)
  }

  async function openMoodChat() {
    if (!moodId) return
    setCheckInError(null)
    appendMoodCheckIn(moodId, '')
    const { entry, entryId: moodEntryId, error } = await ensureMoodEntryForChat(moodId)
    if (error) {
      setCheckInError(error)
      return
    }
    if (entry) markMoodCheckInSaved(moodId, entry.id)
    navigate('/chat', {
      state: {
        prefill: getMoodChatPrefill(moodId),
        moodId,
        moodEntryId,
      },
    })
  }

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
            <button
              type="button"
              onClick={() => {
                setCheckInSaved(false)
                setCheckInError(null)
                setShowMoodCheckIn(true)
              }}
              className="flex w-full items-center gap-4 rounded-2xl border bg-white p-4 text-left shadow-sm transition hover:shadow-md"
              style={{ borderColor: 'rgba(25,43,63,0.08)', fontFamily: CARDEA_FONT_PRIMARY }}
            >
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#D5AAFF]/70">
                <Heart className="h-5 w-5 text-[#5B3A70]" strokeWidth={2} />
              </span>
              <div>
                <p
                  className="mb-1 text-xs font-bold uppercase tracking-[0.18em]"
                  style={{ color: CARDEA_MUTED }}
                >
                  mood check-in
                </p>
                <h2 className="text-sm font-semibold text-[#062A4A]">Go to mood check-in</h2>
                <p className="mt-1 text-xs leading-relaxed text-[#3A525A]">
                  two quick questions. one minute.
                </p>
              </div>
              <span className="ml-auto text-2xl font-light text-[#A8C5E6]" aria-hidden>
                →
              </span>
            </button>
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
                  initial={{ opacity: 0, x: resource.id === 'feeling-mood' ? 0 : -12 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.28 + index * 0.06 }}
                  whileHover={resource.id === 'feeling-mood' ? undefined : { x: 4 }}
                  className={resource.id === 'feeling-mood' ? undefined : 'will-change-transform'}
                >
                  {resource.id === 'feeling-mood' ? (
                    <HomeFeelingReminderCard
                      title={resource.title}
                      message={resource.description}
                      reminderBgClass={theme.reminderBg}
                      heartStroke={theme.heartStroke}
                    />
                  ) : (
                    <HomeResourceLinkCard
                      to={resource.to}
                      Icon={resource.icon}
                      title={resource.title}
                      description={resource.description}
                      iconWrapClass={resource.iconWrapClass}
                      iconClass={resource.iconClass}
                    />
                  )}
                </motion.div>
              ))}
            </div>
          </motion.section>

          {!moodId ? (
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
                    Today’s gentle reminder
                  </h3>
                  <p className="text-sm leading-relaxed text-[#3A525A]" style={{ fontFamily: CARDEA_FONT_PRIMARY }}>
                    It&apos;s okay to take things one step at a time. Small progress is still progress on your heart
                    health journey.
                  </p>
                </div>
              </div>
            </motion.section>
          ) : null}

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
      {showMoodCheckIn && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-[rgba(25,43,63,0.32)] px-4 py-6 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            className="w-full max-w-lg rounded-3xl bg-white p-5 shadow-2xl sm:p-6"
            style={{ fontFamily: CARDEA_FONT_PRIMARY }}
          >
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <p className="mb-1 text-xs font-bold uppercase tracking-[0.18em]" style={{ color: CARDEA_MUTED }}>
                  mood check-in
                </p>
                <h2
                  className="text-2xl text-[#062A4A]"
                  style={{ fontFamily: "'Bebas Neue', sans-serif", letterSpacing: '0.07em' }}
                >
                  how are you?
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setShowMoodCheckIn(false)}
                className="rounded-full px-3 py-1.5 text-sm font-semibold"
                style={{ color: CARDEA_MUTED }}
              >
                close
              </button>
            </div>

            <div className="flex flex-wrap gap-2">
              {MOOD_VARIANTS.map((m, index) => (
                <HomeMoodChipButton
                  key={m.id}
                  label={m.label}
                  selected={moodId === m.id}
                  onClick={() => {
                    setMoodId(m.id)
                    setCheckInSaved(false)
                    setCheckInError(null)
                    clearMoodCheckInSession()
                  }}
                  activeClassNames={`${m.chipBg} ${m.chipText}`}
                  index={index}
                />
              ))}
            </div>

            <div className="mt-4 rounded-2xl border bg-[#f5f9f9] p-4" style={{ borderColor: 'rgba(25,43,63,0.08)' }}>
              <p className="mb-3 text-sm font-semibold text-[#192b3f]">
                Want to explore what&apos;s underneath it?
              </p>
              <button
                type="button"
                disabled={!moodId}
                onClick={() => void openMoodChat()}
                className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"
                style={{ background: '#577568', fontFamily: CARDEA_FONT_PRIMARY }}
              >
                Open chat
              </button>
              {checkInError ? (
                <p className="mt-2 text-xs leading-relaxed text-[#9B1C31]">{checkInError}</p>
              ) : null}
              <div className="mt-3 flex items-center justify-between gap-3">
                <p className="text-xs leading-relaxed" style={{ color: CARDEA_MUTED }}>
                  one minute. no perfect answer needed.
                </p>
                <div className="flex items-center gap-2">
                  {checkInSaved && (
                    <span className="text-xs font-semibold" style={{ color: '#577568' }}>
                      saved
                    </span>
                  )}
                  <button
                    type="button"
                    disabled={!moodId}
                    onClick={() => void saveMoodCheckIn()}
                    className="rounded-full px-4 py-2 text-xs font-semibold text-white disabled:opacity-40"
                    style={{ background: '#577568' }}
                  >
                    Save check-in
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  )
}
