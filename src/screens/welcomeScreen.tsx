import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, useReducedMotion } from 'motion/react'
import {
  CategoryAccent,
  OnboardingAmbientOrbs,
  OnboardingStepBanner,
  WelcomeReassuranceRow,
  type OnboardingVisualVariant,
} from '../components/onboarding/onboardingVisuals'
import { OnboardingProgressDots } from '../components/OnboardingProgressDots'
import { supabase } from '../lib/supabaseClient'
import { moodShellBackgroundClasses, MoodHeartFill, useMood } from '../mood'
import {
  CARDEA_ALMOST_WHITE,
  CARDEA_DARK_GREEN,
  CARDEA_FONT_PRIMARY,
  CARDEA_LIGHT_BLUE,
  CARDEA_MUTED,
  CARDEA_NAVY,
} from '../ui/cardeaTokens'

type OnboardingStep =
  | 'welcome'
  | 'age-at-diagnosis'
  | 'current-age'
  | 'diagnosis-categories'
  | 'personalizing'

const ageOptions = [
  'Prenatal',
  'Infant (1 and under)',
  'Preschooler (2-5)',
  'School Age (6-12)',
  'Teen (13-17)',
  'Young Adult (18-39)',
  'Adult (40+)',
] as const

const diagnosisCategoryOptions = [
  {
    id: 'heart',
    title: 'Heart Condition',
    detail: 'heart problems now or in the past',
  },
  {
    id: 'nicu',
    title: 'NICU-related',
    detail:
      'a health problem at birth when a baby is born too early or too small',
  },
  {
    id: 'genetic',
    title: 'Genetic',
    detail: "a condition you're born with or that runs in the family",
  },
  {
    id: 'mental-health',
    title: 'Mental Health',
    detail: 'feelings like worry, sadness, or stress',
  },
  {
    id: 'neurodevelopmental',
    title: 'Neurodevelopmental & Neurodivergent',
    detail:
      'learning, attention, or behavior differences—like autism or ADHD',
  },
] as const

type DiagnosisCategoryOption = (typeof diagnosisCategoryOptions)[number]

export type DiagnosisCategoryAnswer = {
  id: DiagnosisCategoryOption['id']
  title: string
  detail: string
}

function OnboardingPrimaryButton({
  children,
  disabled,
  onClick,
}: {
  children: ReactNode
  disabled?: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="rounded-xl px-5 py-2.5 text-sm font-semibold text-white transition-opacity disabled:cursor-not-allowed disabled:opacity-40"
      style={{ background: CARDEA_DARK_GREEN, fontFamily: CARDEA_FONT_PRIMARY }}
    >
      {children}
    </button>
  )
}

function OnboardingSecondaryButton({
  children,
  onClick,
}: {
  children: ReactNode
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-xl border px-5 py-2.5 text-sm font-semibold transition-colors"
      style={{
        borderColor: CARDEA_LIGHT_BLUE,
        color: CARDEA_NAVY,
        fontFamily: CARDEA_FONT_PRIMARY,
      }}
    >
      {children}
    </button>
  )
}

function OnboardingStepCard({
  eyebrow,
  title,
  subtitle,
  bannerVariant,
  footnote,
  children,
  nav,
  progressDots,
}: {
  eyebrow: string
  title: string
  subtitle: string
  bannerVariant?: OnboardingVisualVariant
  footnote?: string
  children: ReactNode
  nav: ReactNode
  progressDots: ReactNode
}) {
  return (
    <div className="relative flex min-h-0 flex-1 flex-col px-5 py-8 sm:px-8">
      <div className="relative z-[1] mx-auto flex w-full max-w-lg flex-1 flex-col sm:max-w-2xl">
        <p
          className="mb-3 text-xs font-bold uppercase tracking-[0.18em]"
          style={{ color: CARDEA_MUTED }}
        >
          {eyebrow}
        </p>
        <div
          className="flex min-h-0 flex-1 flex-col rounded-3xl border bg-white/85 p-5 shadow-sm backdrop-blur sm:p-6"
          style={{ borderColor: 'rgba(25,43,63,0.08)' }}
        >
          {bannerVariant ? <OnboardingStepBanner variant={bannerVariant} /> : null}
          <h1
            className="mb-2 text-2xl text-[#062A4A] sm:text-3xl"
            style={{ fontFamily: "'Bebas Neue', sans-serif", letterSpacing: '0.07em' }}
          >
            {title}
          </h1>
          <p className="mb-4 text-sm leading-relaxed text-[#3A525A]" style={{ fontFamily: CARDEA_FONT_PRIMARY }}>
            {subtitle}
          </p>
          <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
          {footnote ? (
            <p className="mt-4 border-t pt-3 text-xs italic leading-relaxed" style={{ color: CARDEA_MUTED, borderColor: 'rgba(25,43,63,0.08)' }}>
              {footnote}
            </p>
          ) : null}
        </div>
        <div className="mt-5 flex flex-col items-center gap-4">
          {nav}
          {progressDots}
        </div>
      </div>
    </div>
  )
}

function AgeOptionList({
  groupLabel,
  value,
  onChange,
  reduceMotion,
}: {
  groupLabel: string
  value: string | null
  onChange: (next: (typeof ageOptions)[number]) => void
  reduceMotion: boolean
}) {
  return (
    <div role="radiogroup" aria-label={groupLabel} className="space-y-2">
      {ageOptions.map((label, index) => {
        const selected = value === label
        return (
          <motion.button
            key={label}
            type="button"
            role="radio"
            aria-checked={selected}
            initial={reduceMotion ? false : { opacity: 0, y: 8 }}
            animate={reduceMotion ? false : { opacity: 1, y: 0 }}
            transition={
              reduceMotion ? undefined : { duration: 0.28, delay: index * 0.035, ease: 'easeOut' }
            }
            onClick={() => onChange(label)}
            className={`w-full rounded-2xl border px-4 py-3 text-left text-sm font-semibold transition-all ${
              selected ? 'shadow-sm' : 'bg-white hover:border-[#577568]/35'
            }`}
            style={{
              fontFamily: CARDEA_FONT_PRIMARY,
              borderColor: selected ? CARDEA_DARK_GREEN : 'rgba(25,43,63,0.08)',
              background: selected ? 'rgba(87, 117, 104, 0.12)' : undefined,
              color: selected ? CARDEA_DARK_GREEN : CARDEA_NAVY,
            }}
          >
            {label}
          </motion.button>
        )
      })}
    </div>
  )
}

function PersonalizingSpinner() {
  return (
    <div
      className="mt-4 h-12 w-12 animate-spin rounded-full border-[3px] border-[rgba(25,43,63,0.1)] border-t-[#192b3f] motion-reduce:animate-[spin_1.75s_linear_infinite]"
      aria-hidden
    />
  )
}

export function WelcomeScreen() {
  const navigate = useNavigate()
  const { moodId, theme } = useMood()
  const reduceMotion = useReducedMotion()
  const [step, setStep] = useState<OnboardingStep>('welcome')
  const [isSaving, setIsSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [didPersist, setDidPersist] = useState(false)
  const persistStartedRef = useRef(false)
  const [answers, setAnswers] = useState<{
    ageAtDiagnosis: string | null
    currentChildAge: string | null
    diagnosisCategories: DiagnosisCategoryAnswer[]
  }>({
    ageAtDiagnosis: null,
    currentChildAge: null,
    diagnosisCategories: [],
  })

  function toggleDiagnosisCategory(option: DiagnosisCategoryOption) {
    setAnswers((prev) => {
      const exists = prev.diagnosisCategories.some((d) => d.id === option.id)
      return {
        ...prev,
        diagnosisCategories: exists
          ? prev.diagnosisCategories.filter((d) => d.id !== option.id)
          : [
              ...prev.diagnosisCategories,
              { id: option.id, title: option.title, detail: option.detail },
            ],
      }
    })
  }

  useEffect(() => {
    if (step !== 'personalizing') {
      persistStartedRef.current = false
    }
  }, [step])

  useEffect(() => {
    if (step !== 'personalizing') return
    if (didPersist) return
    if (persistStartedRef.current) return
    persistStartedRef.current = true

    let cancelled = false

    async function ensureAuthedUserId(): Promise<string> {
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession()
      if (sessionError) throw sessionError
      if (sessionData.session?.user?.id) return sessionData.session.user.id

      const { data: anonData, error: anonError } = await supabase.auth.signInAnonymously()
      if (anonError) throw anonError
      const uid = anonData.user?.id
      if (!uid) throw new Error('Could not create a user session.')
      return uid
    }

    function formatSupabaseishError(e: unknown): string {
      if (!e) return 'Could not save onboarding answers. Please try again.'
      if (e instanceof Error) return e.message || 'Could not save onboarding answers. Please try again.'
      if (typeof e === 'object') {
        const maybe = e as { message?: unknown; details?: unknown; hint?: unknown; code?: unknown }
        const parts = [maybe.message, maybe.details, maybe.hint, maybe.code]
          .filter((p) => typeof p === 'string' && p.trim().length > 0) as string[]
        if (parts.length) return parts.join(' — ')
        try {
          return JSON.stringify(e)
        } catch {
          // ignore
        }
      }
      return String(e)
    }

    async function persistOnboarding() {
      setIsSaving(true)
      setSaveError(null)
      try {
        const uid = await ensureAuthedUserId()
        const condition = answers.diagnosisCategories
          .map((d) => d.title.trim())
          .filter((t) => t.length > 0)
          .join(', ')

        const { error: upErr } = await supabase
          .from('users')
          .update({
            diagnosis_age_category: answers.ageAtDiagnosis,
            current_age_category: answers.currentChildAge,
            condition,
          })
          .eq('id', uid)

        if (upErr) throw upErr
        if (!cancelled) setDidPersist(true)
      } catch (e) {
        if (!cancelled) setSaveError(formatSupabaseishError(e))
      } finally {
        if (!cancelled) setIsSaving(false)
      }
    }

    void persistOnboarding()

    return () => {
      cancelled = true
    }
  }, [answers, didPersist, step])

  useEffect(() => {
    if (step !== 'personalizing') return
    if (saveError) return
    if (!didPersist) return
    const t = window.setTimeout(() => navigate('/home'), 1200)
    return () => window.clearTimeout(t)
  }, [didPersist, navigate, saveError, step])

  const currentAgeOk = answers.currentChildAge != null

  const stepNav = (back: () => void, continueDisabled: boolean, onContinue: () => void) => (
    <div className="flex flex-wrap items-center justify-center gap-2">
      <OnboardingSecondaryButton onClick={back}>Back</OnboardingSecondaryButton>
      <OnboardingPrimaryButton disabled={continueDisabled} onClick={onContinue}>
        Continue
      </OnboardingPrimaryButton>
    </div>
  )

  return (
    <div
      className={`relative flex min-h-screen flex-col transition-all duration-700 ${moodShellBackgroundClasses(moodId, theme.pageBg)}`}
      style={{ fontFamily: CARDEA_FONT_PRIMARY, color: CARDEA_NAVY }}
    >
      <OnboardingAmbientOrbs />
      <div className="relative z-[1] flex min-h-0 flex-1 flex-col">
        {step === 'welcome' && (
          <>
            <motion.header
              initial={{ opacity: 0, y: -16 }}
              animate={{ opacity: 1, y: 0 }}
              className="border-b-4 border-transparent bg-white px-5 pb-8 pt-10 shadow-sm transition-all duration-700 sm:px-8"
              style={{ borderImage: theme.borderGradient }}
            >
              <p
                className="mb-5 text-center text-xs font-bold uppercase tracking-[0.2em]"
                style={{ color: CARDEA_MUTED }}
              >
                Cardea
              </p>

              <div className="mx-auto mb-5 max-w-md px-0 sm:max-w-lg">
                <OnboardingStepBanner variant="welcome" />
              </div>

              <h1
                className="mb-2 text-center text-3xl text-[#062A4A] sm:text-4xl"
                style={{ fontFamily: "'Bebas Neue', sans-serif", letterSpacing: '0.06em' }}
              >
                Welcome.
              </h1>
              <p className="mx-auto mb-3 max-w-md text-center text-lg font-medium leading-snug text-[#3A525A] sm:text-xl">
                You are not alone in this journey.
              </p>
              <WelcomeReassuranceRow />
              <p
                className="mx-auto mt-4 max-w-xl text-center text-sm leading-relaxed sm:text-base"
                style={{ color: CARDEA_MUTED }}
              >
                Caring for a child with complex medical needs can feel overwhelming. You don&apos;t have to navigate it
                alone. This space is here to support you — gently and at your pace.
              </p>
            </motion.header>

            <div className="mx-auto flex w-full max-w-lg flex-col items-center gap-5 px-5 py-8 sm:max-w-2xl sm:px-8">
              <OnboardingPrimaryButton onClick={() => setStep('age-at-diagnosis')}>
                Continue
              </OnboardingPrimaryButton>
              <OnboardingProgressDots totalSteps={4} currentStep={0} />
            </div>
          </>
        )}

        {step === 'age-at-diagnosis' && (
          <OnboardingStepCard
            eyebrow="Getting to know you · step 1 of 3"
            title="What was your child's age at diagnosis?"
            subtitle="This helps us tailor resources and support to your caregiving stage."
            bannerVariant="timeline"
            footnote="There is no wrong answer — choose what feels closest."
            nav={stepNav(
              () => setStep('welcome'),
              answers.ageAtDiagnosis == null,
              () => setStep('current-age'),
            )}
            progressDots={<OnboardingProgressDots totalSteps={4} currentStep={1} />}
          >
            <AgeOptionList
              groupLabel="Child age at diagnosis"
              value={answers.ageAtDiagnosis}
              reduceMotion={reduceMotion ?? false}
              onChange={(next) =>
                setAnswers((prev) => ({
                  ...prev,
                  ageAtDiagnosis: next,
                }))
              }
            />
          </OnboardingStepCard>
        )}

        {step === 'current-age' && (
          <OnboardingStepCard
            eyebrow="Getting to know you · step 2 of 3"
            title="What is your child's current age?"
            subtitle="This helps us tailor resources and support to your caregiving stage."
            bannerVariant="growth"
            footnote="You can change your answers later in your profile when that is available."
            nav={stepNav(
              () => setStep('age-at-diagnosis'),
              !currentAgeOk,
              () => setStep('diagnosis-categories'),
            )}
            progressDots={<OnboardingProgressDots totalSteps={4} currentStep={2} />}
          >
            <AgeOptionList
              groupLabel="Child current age range"
              value={answers.currentChildAge}
              reduceMotion={reduceMotion ?? false}
              onChange={(next) =>
                setAnswers((prev) => ({
                  ...prev,
                  currentChildAge: next,
                }))
              }
            />
          </OnboardingStepCard>
        )}

        {step === 'diagnosis-categories' && (
          <OnboardingStepCard
            eyebrow="Getting to know you · step 3 of 3"
            title="Which diagnosis categories fit your family?"
            subtitle="You can pick more than one."
            bannerVariant="constellation"
            footnote="Pick all that apply — we use this only to shape what you see first."
            nav={stepNav(
              () => setStep('current-age'),
              answers.diagnosisCategories.length === 0,
              () => setStep('personalizing'),
            )}
            progressDots={<OnboardingProgressDots totalSteps={4} currentStep={3} />}
          >
            <div role="group" aria-label="Diagnosis categories" className="space-y-2">
              {diagnosisCategoryOptions.map((cat, index) => {
                const checked = answers.diagnosisCategories.some((d) => d.id === cat.id)
                return (
                  <motion.label
                    key={cat.id}
                    initial={reduceMotion ? false : { opacity: 0, y: 6 }}
                    animate={reduceMotion ? false : { opacity: 1, y: 0 }}
                    transition={
                      reduceMotion ? undefined : { duration: 0.26, delay: index * 0.04, ease: 'easeOut' }
                    }
                    className={`flex cursor-pointer items-start gap-3 rounded-2xl border px-4 py-3 transition-all ${
                      checked ? 'shadow-sm' : 'bg-white hover:border-[#577568]/35'
                    }`}
                    style={{
                      borderColor: checked ? CARDEA_DARK_GREEN : 'rgba(25,43,63,0.08)',
                      background: checked ? 'rgba(87, 117, 104, 0.12)' : CARDEA_ALMOST_WHITE,
                      color: checked ? CARDEA_DARK_GREEN : CARDEA_NAVY,
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleDiagnosisCategory(cat)}
                      className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer accent-[#577568]"
                    />
                    <CategoryAccent categoryId={cat.id} />
                    <span className="min-w-0 flex-1 text-sm leading-relaxed" style={{ fontFamily: CARDEA_FONT_PRIMARY }}>
                      <span className="font-semibold">{cat.title}</span>
                      <span className="font-medium"> ({cat.detail})</span>
                    </span>
                  </motion.label>
                )
              })}
            </div>
          </OnboardingStepCard>
        )}

        {step === 'personalizing' && (
          <div className="relative flex flex-1 items-center justify-center px-5 py-10 sm:px-8">
            <div
              role="status"
              aria-live="polite"
              aria-busy="true"
              className="w-full max-w-md rounded-3xl border bg-white/85 p-8 text-center shadow-sm backdrop-blur"
              style={{ borderColor: 'rgba(25,43,63,0.08)' }}
            >
              <div className="mb-5 flex justify-center">
                <motion.div
                  animate={reduceMotion ? undefined : { scale: [1, 1.04, 1] }}
                  transition={reduceMotion ? undefined : { duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
                >
                  <MoodHeartFill
                    theme={theme}
                    size={44}
                    viewBox="0 0 100 100"
                    pathD="M50 85C50 85 20 65 20 40C20 25 30 15 40 15C45 15 50 20 50 20C50 20 55 15 60 15C70 15 80 25 80 40C80 65 50 85 50 85Z"
                    stroke={theme.heartStroke}
                    strokeWidth={2}
                  />
                </motion.div>
              </div>
              <div
                className="mx-auto mb-5 h-1 w-24 rounded-full"
                style={{ background: `linear-gradient(90deg, transparent, ${CARDEA_LIGHT_BLUE}, transparent)` }}
                aria-hidden
              />
              <p
                className="text-2xl text-[#062A4A]"
                style={{ fontFamily: "'Bebas Neue', sans-serif", letterSpacing: '0.07em' }}
              >
                Personalizing your support experience...
              </p>
              <p className="mt-2 text-xs leading-relaxed" style={{ color: CARDEA_MUTED }}>
                Just a moment.
              </p>
              <div className="flex justify-center" aria-label="Loading">
                <PersonalizingSpinner />
              </div>
              {saveError ? (
                <div className="mt-4">
                  <p role="alert" className="text-sm font-semibold leading-relaxed text-[#9B1C31]">
                    {saveError}
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setDidPersist(false)
                      setSaveError(null)
                    }}
                    disabled={isSaving}
                    className="mt-3 rounded-xl px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-40"
                    style={{ background: CARDEA_DARK_GREEN }}
                  >
                    Retry
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
