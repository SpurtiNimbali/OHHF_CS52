import React, { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { OnboardingProgressDots } from '../components/OnboardingProgressDots'
import { CustomSelect } from '../components/CustomSelect'
import welcomeHeart from '../assets/images/OHHF_heart.png'
import { supabase } from '../lib/supabaseClient'

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

/** Single app “dark blue” for text, borders, and primary actions. */
const COLOR_NAVY = '#0A2E5C'

const FONT_UI = 'Montserrat, sans-serif' as const

const stepTitleStyle: React.CSSProperties = {
  fontFamily: FONT_UI,
  fontSize: 28,
  lineHeight: 1.15,
  margin: 0,
  fontWeight: 700,
  color: COLOR_NAVY,
  // Keep dropdowns aligned across steps even when titles wrap.
  minHeight: 66,
}

const stepSubtitleStyle: React.CSSProperties = {
  fontFamily: FONT_UI,
  fontSize: 18,
  lineHeight: 1.35,
  margin: 0,
  fontWeight: 500,
  color: 'rgba(10, 46, 92, 0.88)',
}

const primaryButtonStyle: React.CSSProperties = {
  border: 'none',
  background: COLOR_NAVY,
  color: '#FFFFFF',
  padding: '12px 28px',
  borderRadius: 12,
  fontSize: 16,
  fontWeight: 650,
  fontFamily: FONT_UI,
  cursor: 'pointer',
  minWidth: 168,
  boxSizing: 'border-box',
}

const backButtonStyle: React.CSSProperties = {
  border: '2px solid rgba(10, 46, 92, 0.35)',
  background: 'transparent',
  color: COLOR_NAVY,
  padding: '12px 28px',
  borderRadius: 12,
  fontSize: 16,
  fontWeight: 650,
  fontFamily: FONT_UI,
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
    <div
      style={{
        flex: 1,
        minHeight: 0,
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
      }}
    >
      <div
        style={{
          flex: 1,
          minHeight: 0,
          width: '100%',
          maxWidth: 560,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 14,
          overflow: 'hidden',
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

/** Index along `ageOptions`: higher means older (same ordering as the UI list). */
function ageCategoryIndex(label: string | null): number {
  if (!label) return -1
  return ageOptions.indexOf(label as (typeof ageOptions)[number])
}

function isValidCurrentVsDiagnosisAge(
  diagnosis: string | null,
  current: string | null,
): boolean {
  if (diagnosis == null || current == null) return false
  return ageCategoryIndex(current) >= ageCategoryIndex(diagnosis)
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
          border: '3px solid rgba(10, 46, 92, 0.1)',
          borderTopColor: COLOR_NAVY,
          borderRightColor: 'rgba(10, 46, 92, 0.38)',
          marginTop: 22,
          boxShadow: '0 4px 20px rgba(10, 46, 92, 0.07)',
          boxSizing: 'border-box',
        }}
      />
    </>
  )
}

export function WelcomeScreen() {
  const navigate = useNavigate()
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
    if (step !== 'current-age' || answers.ageAtDiagnosis == null) return
    setAnswers((prev) => {
      if (prev.currentChildAge == null) return prev
      if (!isValidCurrentVsDiagnosisAge(prev.ageAtDiagnosis, prev.currentChildAge)) {
        return { ...prev, currentChildAge: null }
      }
      return prev
    })
  }, [step, answers.ageAtDiagnosis])

  // If the user ever leaves the personalizing step, allow re-save when they return.
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

  const currentAgeOk = isValidCurrentVsDiagnosisAge(
    answers.ageAtDiagnosis,
    answers.currentChildAge,
  )

  return (
    <main
      style={{
        minHeight: '100vh',
        boxSizing: 'border-box',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: 24,
        paddingTop: step === 'welcome' ? 24 : 44,
        textAlign: 'center',
        color: COLOR_NAVY,
        background: '#EEF1F4',
        fontFamily: FONT_UI,
      }}
    >
      {step === 'welcome' && (
        <>
          <div
            style={{
              flex: 1,
              minHeight: 0,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              alignItems: 'center',
              gap: 14,
              width: '100%',
            }}
          >
            <div
              aria-hidden="true"
              style={{
                width: 140,
                height: 140,
                borderRadius: '50%',
                display: 'grid',
                placeItems: 'center',
                background:
                  'radial-gradient(circle at 30% 25%, rgba(255, 255, 255, 0.95), rgba(232, 223, 242, 0.92) 45%, rgba(216, 200, 238, 0.9) 100%)',
                boxShadow:
                  '0 12px 26px rgba(15, 23, 42, 0.12), 0 2px 4px rgba(15, 23, 42, 0.06)',
                marginBottom: 6,
              }}
            >
              <img
                src={welcomeHeart}
                alt=""
                style={{
                  width: 90,
                  height: 90,
                  objectFit: 'contain',
                  filter: 'drop-shadow(0 6px 10px rgba(15, 23, 42, 0.12))',
                }}
              />
            </div>

            <h1
              style={{
                fontFamily: FONT_UI,
                fontSize: 50,
                lineHeight: 1.05,
                margin: 0,
                fontWeight: 800,
                letterSpacing: -0.8,
                color: COLOR_NAVY,
              }}
            >
              Welcome.
            </h1>
            <p
              style={{
                fontFamily: FONT_UI,
                fontSize: 22,
                lineHeight: 1.25,
                margin: 0,
                fontWeight: 500,
                color: 'rgba(10, 46, 92, 0.72)',
              }}
            >
              You are not alone in this journey.
            </p>
            <p
              style={{
                fontFamily: FONT_UI,
                fontSize: 16,
                lineHeight: 1.55,
                margin: 0,
                maxWidth: 600,
                fontWeight: 500,
                color: 'rgba(10, 46, 92, 0.62)',
              }}
            >
              Caring for a child with complex medical needs can feel overwhelming.
              <br />
              You don’t have to navigate it alone.
              <br />
              This space is here to support you — gently and at your pace.
            </p>
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
            <button
              type="button"
              onClick={() => setStep('age-at-diagnosis')}
              style={{
                ...primaryButtonStyle,
                boxShadow:
                  '0 10px 28px rgba(10, 46, 92, 0.18), 0 2px 6px rgba(10, 46, 92, 0.08)',
              }}
            >
              Continue
            </button>
            <OnboardingProgressDots totalSteps={4} currentStep={0} />
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
          progressDots={<OnboardingProgressDots totalSteps={4} currentStep={1} />}
        >
          <h1 style={stepTitleStyle}>What was your child&apos;s age at diagnosis?</h1>
          <p style={stepSubtitleStyle}>
            This helps us tailor resources and support to your caregiving stage.
          </p>
          <div style={{ width: '100%', alignSelf: 'stretch' }}>
            <CustomSelect
              id="age-at-diagnosis"
              label="Child age at diagnosis"
              placeholder="Select age range"
              value={(answers.ageAtDiagnosis as (typeof ageOptions)[number] | null) ?? null}
              options={ageOptions.map((label) => ({ value: label, label }))}
              maxWidth={560}
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
          progressDots={<OnboardingProgressDots totalSteps={4} currentStep={2} />}
        >
          <h1 style={stepTitleStyle}>What is your child&apos;s current age?</h1>
          <p style={stepSubtitleStyle}>
            This helps us tailor resources and support to your caregiving stage.
          </p>
          <div style={{ width: '100%', alignSelf: 'stretch' }}>
            <CustomSelect
              id="current-child-age"
              label="Child current age range"
              placeholder="Select age range"
              value={(answers.currentChildAge as (typeof ageOptions)[number] | null) ?? null}
              maxWidth={560}
              options={ageOptions.map((label) => {
                const diagnosisIdx = ageCategoryIndex(answers.ageAtDiagnosis)
                const optionIdx = ageCategoryIndex(label)
                const disabled =
                  diagnosisIdx >= 0 && optionIdx >= 0 && optionIdx < diagnosisIdx
                return { value: label, label, disabled }
              })}
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
          progressDots={<OnboardingProgressDots totalSteps={4} currentStep={3} />}
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
                    fontFamily: FONT_UI,
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 10,
                    padding: '10px 12px',
                    borderRadius: 12,
                    border: checked ? '2px solid #577568' : '1px solid rgba(10, 46, 92, 0.25)',
                    background: checked ? 'rgba(172, 183, 168, 0.52)' : '#FFFFFF',
                    cursor: 'pointer',
                    fontSize: 15,
                    fontWeight: 500,
                    color: checked ? '#577568' : COLOR_NAVY,
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
                      accentColor: checked ? '#577568' : COLOR_NAVY,
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
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '100%',
          }}
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
            }}
          >
            <p
              style={{
                fontFamily: FONT_UI,
                fontSize: 22,
                lineHeight: 1.35,
                margin: 0,
                fontWeight: 650,
                color: COLOR_NAVY,
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
                    fontFamily: FONT_UI,
                    fontSize: 14,
                    lineHeight: 1.45,
                    fontWeight: 650,
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
  )
}

