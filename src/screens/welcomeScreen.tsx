import React, { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'motion/react'
import { OnboardingProgressDots } from '../components/OnboardingProgressDots'
import { supabase } from '../lib/supabaseClient'
import { moodShellBackgroundClasses, MoodHeartFill, useMood } from '../mood'
import {
  CARDEA_DARK_GREEN,
  CARDEA_FONT_PRIMARY,
  CARDEA_MUTED,
  CARDEA_NAVY,
} from '../ui/cardeaTokens'

/** Matches home hero title color */
const HOME_HEADING_BLUE = '#062A4A'
const HOME_BODY = '#3A525A'

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



const stepTitleStyle: React.CSSProperties = {
  fontFamily: "'Bebas Neue', sans-serif",
  letterSpacing: '0.06em',
  fontSize: 'clamp(1.5rem, 5vw, 2rem)',
  lineHeight: 1.15,
  margin: 0,
  fontWeight: 700,
  color: HOME_HEADING_BLUE,
  minHeight: 66,
  textAlign: 'center',
  width: '100%',
}

const stepSubtitleStyle: React.CSSProperties = {
  fontFamily: CARDEA_FONT_PRIMARY,
  fontSize: 18,
  lineHeight: 1.35,
  margin: 0,
  fontWeight: 500,
  color: HOME_BODY,
  textAlign: 'center',
}

const primaryButtonStyle: React.CSSProperties = {
  border: 'none',
  background: CARDEA_NAVY,
  color: '#FFFFFF',
  padding: '12px 28px',
  borderRadius: 16,
  fontSize: 16,
  fontWeight: 600,
  fontFamily: CARDEA_FONT_PRIMARY,
  cursor: 'pointer',
  minWidth: 168,
  boxSizing: 'border-box',
}

const backButtonStyle: React.CSSProperties = {
  border: '2px solid rgba(25, 43, 63, 0.18)',
  background: 'transparent',
  color: CARDEA_NAVY,
  padding: '12px 28px',
  borderRadius: 16,
  fontSize: 16,
  fontWeight: 600,
  fontFamily: CARDEA_FONT_PRIMARY,
  cursor: 'pointer',
  minWidth: 168,
  boxSizing: 'border-box',
}

const navRowStyle: React.CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 12,
  justifyContent: 'center',
  alignItems: 'center',
}

function OnboardingFormLayout({
  children,
  nav,
  progressDots,
}: {
  children: React.ReactNode
  nav: React.ReactNode
  progressDots: React.ReactNode
}) {
  return (
    <div className="flex flex-1 min-h-0 w-full flex-col items-center px-5 sm:px-8 py-6 box-border">
      <div
        style={{
          flex: 1,
          minHeight: 0,
          width: '100%',
          maxWidth: 560,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'stretch',
          gap: 14,
          minHeight: 0,
          boxSizing: 'border-box',
        }}
      >
        {children}
      </div>
      <div
        style={{
          flexShrink: 0,
          width: '100%',
          maxWidth: 560,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 18,
          paddingTop: 16,
        }}
      >
        {nav}
        {progressDots}
      </div>
    </div>
  )
}

function AgeOptionList({
  groupLabel,
  value,
  onChange,
}: {
  groupLabel: string
  value: string | null
  onChange: (next: (typeof ageOptions)[number]) => void
}) {
  return (
    <div
      role="radiogroup"
      aria-label={groupLabel}
      style={{
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        textAlign: 'left',
      }}
    >
      {ageOptions.map((label) => {
        const selected = value === label
        return (
          <button
            key={label}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(label)}
            style={{
              fontFamily: CARDEA_FONT_PRIMARY,
              display: 'block',
              width: '100%',
              textAlign: 'left',
              padding: '12px 14px',
              borderRadius: 16,
              border: selected
                ? `2px solid ${CARDEA_DARK_GREEN}`
                : '1px solid rgba(25, 43, 63, 0.12)',
              background: selected ? 'rgba(172, 183, 168, 0.52)' : '#FFFFFF',
              cursor: 'pointer',
              fontSize: 16,
              fontWeight: 600,
              color: selected ? CARDEA_DARK_GREEN : CARDEA_NAVY,
              boxSizing: 'border-box',
              transition: 'border-color 120ms ease, background-color 120ms ease, color 120ms ease',
            }}
          >
            {label}
          </button>
        )
      })}
    </div>
  )
}

function PersonalizingSpinner() {
  return (
    <>
      <style>
        {`
          @keyframes ohhf-personalize-spin {
            to { transform: rotate(360deg); }
          }
          .ohhf-personalize-spinner {
            animation: ohhf-personalize-spin 0.95s linear infinite;
          }
          @media (prefers-reduced-motion: reduce) {
            .ohhf-personalize-spinner {
              animation-duration: 1.75s;
            }
          }
        `}
      </style>
      <div
        className="ohhf-personalize-spinner"
        aria-hidden
        style={{
          width: 56,
          height: 56,
          borderRadius: '50%',
          border: '3px solid rgba(25, 43, 63, 0.1)',
          borderTopColor: CARDEA_NAVY,
          borderRightColor: 'rgba(25, 43, 63, 0.32)',
          marginTop: 22,
          boxShadow: '0 4px 20px rgba(25, 43, 63, 0.08)',
          boxSizing: 'border-box',
        }}
      />
    </>
  )
}

export function WelcomeScreen() {
  const navigate = useNavigate()
  const { moodId, theme } = useMood()
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
            // Store only the title part (not the parenthesized detail shown in the UI).
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

  // Final step: pause briefly for the “personalizing” moment, then go to Home.
  useEffect(() => {
    if (step !== 'personalizing') return
    if (saveError) return
    if (!didPersist) return
    const t = window.setTimeout(() => navigate('/home'), 1200)
    return () => window.clearTimeout(t)
  }, [didPersist, navigate, saveError, step])

  const currentAgeOk = answers.currentChildAge != null

  const showMiniHeader =
    step === 'age-at-diagnosis' ||
    step === 'current-age' ||
    step === 'diagnosis-categories'

  return (
    <div
      className={`min-h-screen flex flex-col transition-all duration-700 ${moodShellBackgroundClasses(moodId, theme.pageBg)}`}
      style={{ fontFamily: CARDEA_FONT_PRIMARY, color: CARDEA_NAVY }}
    >
      {showMiniHeader && (
        <header
          className="shrink-0 bg-white px-5 sm:px-8 py-4 shadow-sm border-b-4 border-transparent transition-all duration-700"
          style={{ borderImage: theme.borderGradient }}
        >
          <p
            className="text-center text-xs font-bold uppercase tracking-[0.2em]"
            style={{ color: CARDEA_MUTED }}
          >
            Cardea
          </p>
        </header>
      )}

      <main className="flex flex-col flex-1 min-h-0 w-full box-border">
        {step === 'welcome' && (
          <>
            <motion.header
              initial={{ opacity: 0, y: -12 }}
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
                className="text-3xl sm:text-4xl text-center mb-2"
                style={{
                  fontFamily: "'Bebas Neue', sans-serif",
                  letterSpacing: '0.06em',
                  color: HOME_HEADING_BLUE,
                }}
              >
                Welcome.
              </h1>
              <p
                className="text-center text-lg sm:text-xl max-w-md mx-auto mb-3 font-medium leading-snug"
                style={{ color: HOME_BODY }}
              >
                You are not alone in this journey.
              </p>
              <p
                className="text-center text-sm sm:text-base max-w-xl mx-auto leading-relaxed"
                style={{ color: CARDEA_MUTED }}
              >
                Caring for a child with complex medical needs can feel overwhelming.
                <br />
                You don’t have to navigate it alone.
                <br />
                This space is here to support you — gently and at your pace.
              </p>
            </motion.header>

            <div className="flex flex-col items-center px-5 sm:px-8 py-8 pb-10 gap-4 w-full max-w-lg mx-auto sm:max-w-xl">
              <button
                type="button"
                onClick={() => setStep('age-at-diagnosis')}
                style={{
                  ...primaryButtonStyle,
                  boxShadow: '0 8px 24px rgba(25, 43, 63, 0.12)',
                }}
              >
                Continue
              </button>
              <OnboardingProgressDots className="text-[#192b3f]" totalSteps={4} currentStep={0} />
            </div>
          </>
        )}

        {step === 'age-at-diagnosis' && (
          <OnboardingFormLayout
            nav={
              <div style={navRowStyle}>
                <button type="button" onClick={() => setStep('welcome')} style={backButtonStyle}>
                  Back
                </button>
                <button
                  type="button"
                  disabled={answers.ageAtDiagnosis == null}
                  onClick={() => setStep('current-age')}
                  style={{
                    ...primaryButtonStyle,
                    opacity: answers.ageAtDiagnosis == null ? 0.45 : 1,
                    cursor: answers.ageAtDiagnosis == null ? 'not-allowed' : 'pointer',
                  }}
                >
                  Continue
                </button>
              </div>
            }
            progressDots={<OnboardingProgressDots className="text-[#192b3f]" totalSteps={4} currentStep={1} />}
          >
            <h1 style={stepTitleStyle}>What was your child&apos;s age at diagnosis?</h1>
            <p style={stepSubtitleStyle}>
              This helps us tailor resources and support to your caregiving stage.
            </p>
            <div
              style={{
                flex: 1,
                minHeight: 0,
                width: '100%',
                alignSelf: 'stretch',
                marginTop: 6,
                overflowY: 'auto',
                WebkitOverflowScrolling: 'touch',
              }}
            >
              <AgeOptionList
                groupLabel="Child age at diagnosis"
                value={answers.ageAtDiagnosis}
                onChange={(next) =>
                  setAnswers((prev) => ({
                    ...prev,
                    ageAtDiagnosis: next,
                  }))
                }
              />
            </div>
          </OnboardingFormLayout>
        )}

        {step === 'current-age' && (
          <OnboardingFormLayout
            nav={
              <div style={navRowStyle}>
                <button type="button" onClick={() => setStep('age-at-diagnosis')} style={backButtonStyle}>
                  Back
                </button>
                <button
                  type="button"
                  disabled={!currentAgeOk}
                  onClick={() => setStep('diagnosis-categories')}
                  style={{
                    ...primaryButtonStyle,
                    opacity: currentAgeOk ? 1 : 0.45,
                    cursor: currentAgeOk ? 'pointer' : 'not-allowed',
                  }}
                >
                  Continue
                </button>
              </div>
            }
            progressDots={<OnboardingProgressDots className="text-[#192b3f]" totalSteps={4} currentStep={2} />}
          >
            <h1 style={stepTitleStyle}>What is your child&apos;s current age?</h1>
            <p style={stepSubtitleStyle}>
              This helps us tailor resources and support to your caregiving stage.
            </p>
            <div
              style={{
                flex: 1,
                minHeight: 0,
                width: '100%',
                alignSelf: 'stretch',
                marginTop: 6,
                overflowY: 'auto',
                WebkitOverflowScrolling: 'touch',
              }}
            >
              <AgeOptionList
                groupLabel="Child current age range"
                value={answers.currentChildAge}
                onChange={(next) =>
                  setAnswers((prev) => ({
                    ...prev,
                    currentChildAge: next,
                  }))
                }
              />
            </div>
          </OnboardingFormLayout>
        )}

        {step === 'diagnosis-categories' && (
          <OnboardingFormLayout
            nav={
              <div style={navRowStyle}>
                <button type="button" onClick={() => setStep('current-age')} style={backButtonStyle}>
                  Back
                </button>
                <button
                  type="button"
                  disabled={answers.diagnosisCategories.length === 0}
                  onClick={() => setStep('personalizing')}
                  style={{
                    ...primaryButtonStyle,
                    opacity: answers.diagnosisCategories.length === 0 ? 0.45 : 1,
                    cursor: answers.diagnosisCategories.length === 0 ? 'not-allowed' : 'pointer',
                  }}
                >
                  Continue
                </button>
              </div>
            }
            progressDots={<OnboardingProgressDots className="text-[#192b3f]" totalSteps={4} currentStep={3} />}
          >
            <h1 style={stepTitleStyle}>Which diagnosis categories fit your family?</h1>
            <p style={stepSubtitleStyle}>You can pick more than one.</p>
            <div
              role="group"
              aria-label="Diagnosis categories"
              style={{
                flex: 1,
                minHeight: 0,
                width: '100%',
                alignSelf: 'stretch',
                marginTop: 6,
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
                textAlign: 'left',
                overflowY: 'auto',
              }}
            >
              {diagnosisCategoryOptions.map((cat) => {
                const checked = answers.diagnosisCategories.some((d) => d.id === cat.id)
                return (
                  <label
                    key={cat.id}
                    style={{
                      fontFamily: CARDEA_FONT_PRIMARY,
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: 10,
                      padding: '10px 12px',
                      borderRadius: 16,
                      border: checked
                        ? `2px solid ${CARDEA_DARK_GREEN}`
                        : '1px solid rgba(25, 43, 63, 0.12)',
                      background: checked ? 'rgba(172, 183, 168, 0.52)' : '#FFFFFF',
                      cursor: 'pointer',
                      fontSize: 15,
                      fontWeight: 500,
                      color: checked ? CARDEA_DARK_GREEN : CARDEA_NAVY,
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleDiagnosisCategory(cat)}
                      style={{
                        marginTop: 1,
                        width: 16,
                        height: 16,
                        flexShrink: 0,
                        cursor: 'pointer',
                        accentColor: checked ? CARDEA_DARK_GREEN : CARDEA_NAVY,
                      }}
                    />
                    <span style={{ lineHeight: 1.45 }}>
                      <span style={{ fontWeight: 600 }}>{cat.title}</span>
                      <span style={{ fontWeight: 500 }}> ({cat.detail})</span>
                    </span>
                  </label>
                )
              })}
            </div>
          </OnboardingFormLayout>
        )}

        {step === 'personalizing' && (
          <div
            className="flex flex-1 items-center justify-center w-full px-5"
            style={{ minHeight: '50vh' }}
          >
            <div
              role="status"
              aria-live="polite"
              aria-busy="true"
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 8,
                maxWidth: 480,
                textAlign: 'center',
              }}
            >
              <p
                style={{
                  fontFamily: "'Bebas Neue', sans-serif",
                  letterSpacing: '0.05em',
                  fontSize: 'clamp(1.25rem, 4vw, 1.75rem)',
                  lineHeight: 1.35,
                  margin: 0,
                  fontWeight: 700,
                  color: HOME_HEADING_BLUE,
                }}
              >
                Personalizing your support experience...
              </p>
              <div aria-label="Loading">
                <PersonalizingSpinner />
              </div>
              {saveError && (
                <div style={{ marginTop: 10, textAlign: 'center' }}>
                  <p
                    role="alert"
                    style={{
                      margin: 0,
                      fontFamily: CARDEA_FONT_PRIMARY,
                      fontSize: 14,
                      lineHeight: 1.45,
                      fontWeight: 600,
                      color: '#9B1C31',
                    }}
                  >
                    {saveError}
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setDidPersist(false)
                      setSaveError(null)
                    }}
                    style={{
                      marginTop: 10,
                      ...primaryButtonStyle,
                      opacity: isSaving ? 0.55 : 1,
                      cursor: isSaving ? 'not-allowed' : 'pointer',
                    }}
                    disabled={isSaving}
                  >
                    Retry
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  )
}

