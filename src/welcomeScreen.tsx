import React, { useEffect, useState } from 'react'
import { OnboardingProgressDots } from './components/OnboardingProgressDots'
import { CustomSelect } from './components/CustomSelect'
import welcomeHeart from './assets/images/OHHF_heart.png'

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

const primaryButtonStyle: React.CSSProperties = {
  marginTop: 10,
  border: 'none',
  background: '#0A2E5C',
  color: '#FFFFFF',
  padding: '12px 18px',
  borderRadius: 12,
  fontSize: 16,
  fontWeight: 650,
  cursor: 'pointer',
}

const backButtonStyle: React.CSSProperties = {
  border: '2px solid rgba(10, 46, 92, 0.35)',
  background: 'transparent',
  color: '#0A2E5C',
  padding: '12px 18px',
  borderRadius: 12,
  fontSize: 16,
  fontWeight: 650,
  cursor: 'pointer',
}

const navRowStyle: React.CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 12,
  justifyContent: 'center',
  alignItems: 'center',
  marginTop: 10,
}

function ageSelectStyle(hasValue: boolean): React.CSSProperties {
  return {
    marginTop: 8,
    width: '100%',
    maxWidth: 520,
    borderRadius: 12,
    padding: '12px 14px',
    fontSize: 14,
    fontWeight: 650,
    border: hasValue ? '2px solid #0A2E5C' : '1px solid rgba(10, 46, 92, 0.25)',
    background: hasValue ? 'rgba(10, 46, 92, 0.08)' : '#FFFFFF',
    color: '#0A2E5C',
    cursor: 'pointer',
    fontFamily: 'inherit',
  }
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
          borderTopColor: '#0A2E5C',
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
  const [step, setStep] = useState<OnboardingStep>('welcome')
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

  const currentAgeOk = isValidCurrentVsDiagnosisAge(
    answers.ageAtDiagnosis,
    answers.currentChildAge,
  )

  return (
    <main
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: step === 'welcome' ? 'center' : 'flex-start',
        alignItems: 'center',
        padding: 24,
        paddingTop: step === 'welcome' ? 24 : 44,
        textAlign: 'center',
        color: '#0A2E5C',
        background: '#EEF1F4',
        gap: 14,
        fontFamily: 'Montserrat, sans-serif',
      }}
    >
      {step === 'welcome' && (
        <>
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
                width: 68,
                height: 68,
                objectFit: 'contain',
                filter: 'drop-shadow(0 6px 10px rgba(15, 23, 42, 0.12))',
              }}
            />
          </div>

          <h1
            style={{
              fontSize: 50,
              lineHeight: 1.05,
              margin: 0,
              fontWeight: 800,
              letterSpacing: -0.8,
              color: '#1F2937',
            }}
          >
            Welcome.
          </h1>
          <p
            style={{
              fontSize: 22,
              lineHeight: 1.25,
              margin: 0,
              fontWeight: 500,
              color: '#4B5563',
            }}
          >
            You are not alone in this journey.
          </p>
          <p
            style={{
              fontSize: 16,
              lineHeight: 1.55,
              margin: 0,
              maxWidth: 600,
              color: '#6B7280',
            }}
          >
            Caring for a child with complex medical needs can feel overwhelming.
            <br />
            You don’t have to navigate it alone.
            <br />
            This space is here to support you — gently and at your pace.
          </p>

          <button
            type="button"
            onClick={() => setStep('age-at-diagnosis')}
            style={{
              ...primaryButtonStyle,
              marginTop: 20,
              width: 'min(560px, 100%)',
              padding: '16px 22px',
              borderRadius: 9999,
              fontSize: 17,
              fontWeight: 700,
              letterSpacing: 0.6,
              textTransform: 'uppercase',
              background: '#1F2937',
              boxShadow:
                '0 18px 38px rgba(15, 23, 42, 0.18), 0 3px 6px rgba(15, 23, 42, 0.12)',
            }}
          >
            Continue
          </button>

          <div style={{ marginTop: 14 }}>
            <OnboardingProgressDots totalSteps={4} currentStep={0} />
          </div>
        </>
      )}

      {step === 'age-at-diagnosis' && (
        <>
          <h1 style={{ fontSize: 28, lineHeight: 1.15, margin: 0, fontWeight: 750 }}>
            What was your child&apos;s age at diagnosis?
          </h1>
          <p style={{ fontSize: 18, lineHeight: 1.3, margin: 0, fontWeight: 600 }}>
            This helps us tailor resources and support to your caregiving stage.
          </p>

          <CustomSelect
            id="age-at-diagnosis"
            label="Child age at diagnosis"
            placeholder="Select age range"
            value={(answers.ageAtDiagnosis as (typeof ageOptions)[number] | null) ?? null}
            options={ageOptions.map((label) => ({ value: label, label }))}
            onChange={(next) =>
              setAnswers((prev) => ({
                ...prev,
                ageAtDiagnosis: next,
              }))
            }
          />

          <div style={navRowStyle}>
            <button type="button" onClick={() => setStep('welcome')} style={{ ...backButtonStyle, marginTop: 0 }}>
              Back
            </button>
            <button
              type="button"
              disabled={answers.ageAtDiagnosis == null}
              onClick={() => setStep('current-age')}
              style={{
                ...primaryButtonStyle,
                marginTop: 0,
                opacity: answers.ageAtDiagnosis == null ? 0.45 : 1,
                cursor: answers.ageAtDiagnosis == null ? 'not-allowed' : 'pointer',
              }}
            >
              Continue
            </button>
          </div>

          <div style={{ marginTop: 18 }}>
            <OnboardingProgressDots totalSteps={4} currentStep={1} />
          </div>
        </>
      )}

      {step === 'current-age' && (
        <>
          <h1 style={{ fontSize: 28, lineHeight: 1.15, margin: 0, fontWeight: 750 }}>
            What is your child&apos;s current age?
          </h1>
          <p style={{ fontSize: 18, lineHeight: 1.3, margin: 0, fontWeight: 600 }}>
            This helps us tailor resources and support to your caregiving stage.
          </p>

          <CustomSelect
            id="current-child-age"
            label="Child current age range"
            placeholder="Select age range"
            value={(answers.currentChildAge as (typeof ageOptions)[number] | null) ?? null}
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

          <div style={navRowStyle}>
            <button
              type="button"
              onClick={() => setStep('age-at-diagnosis')}
              style={{ ...backButtonStyle, marginTop: 0 }}
            >
              Back
            </button>
            <button
              type="button"
              disabled={!currentAgeOk}
              onClick={() => setStep('diagnosis-categories')}
              style={{
                ...primaryButtonStyle,
                marginTop: 0,
                opacity: currentAgeOk ? 1 : 0.45,
                cursor: currentAgeOk ? 'pointer' : 'not-allowed',
              }}
            >
              Continue
            </button>
          </div>

          <div style={{ marginTop: 18 }}>
            <OnboardingProgressDots totalSteps={4} currentStep={2} />
          </div>
        </>
      )}

      {step === 'diagnosis-categories' && (
        <>
          <h1 style={{ fontSize: 32, lineHeight: 1.15, margin: 0, fontWeight: 750 }}>
            Which diagnosis categories fit your family?
          </h1>
          <p style={{ fontSize: 13, lineHeight: 1.4, margin: 0, fontWeight: 500, opacity: 0.85 }}>
            You can pick more than one.
          </p>

          <div
            role="group"
            aria-label="Diagnosis categories"
            style={{
              marginTop: 6,
              width: '100%',
              maxWidth: 560,
              display: 'flex',
              flexDirection: 'column',
              gap: 10,
              textAlign: 'left',
            }}
          >
            {diagnosisCategoryOptions.map((cat) => {
              const checked = answers.diagnosisCategories.some((d) => d.id === cat.id)
              return (
                <label
                  key={cat.id}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 12,
                    padding: '12px 14px',
                    borderRadius: 12,
                    border: checked ? '2px solid #577568' : '1px solid rgba(10, 46, 92, 0.25)',
                    background: checked ? 'rgba(172, 183, 168, 0.52)' : '#FFFFFF',
                    cursor: 'pointer',
                    fontSize: 14,
                    fontWeight: 600,
                    color: checked ? '#577568' : '#0A2E5C',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleDiagnosisCategory(cat)}
                    style={{
                      marginTop: 2,
                      width: 18,
                      height: 18,
                      flexShrink: 0,
                      cursor: 'pointer',
                      accentColor: checked ? '#577568' : '#0A2E5C',
                    }}
                  />
                  <span style={{ lineHeight: 1.45 }}>
                    <span style={{ fontWeight: 650 }}>{cat.title}</span>
                    <span style={{ fontWeight: 500 }}> ({cat.detail})</span>
                  </span>
                </label>
              )
            })}
          </div>

          <div style={navRowStyle}>
            <button
              type="button"
              onClick={() => setStep('current-age')}
              style={{ ...backButtonStyle, marginTop: 0 }}
            >
              Back
            </button>
            <button
              type="button"
              disabled={answers.diagnosisCategories.length === 0}
              onClick={() => setStep('personalizing')}
              style={{
                ...primaryButtonStyle,
                marginTop: 0,
                opacity: answers.diagnosisCategories.length === 0 ? 0.45 : 1,
                cursor: answers.diagnosisCategories.length === 0 ? 'not-allowed' : 'pointer',
              }}
            >
              Continue
            </button>
          </div>

          <div style={{ marginTop: 18 }}>
            <OnboardingProgressDots totalSteps={4} currentStep={3} />
          </div>
        </>
      )}

      {step === 'personalizing' && (
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
              fontSize: 22,
              lineHeight: 1.35,
              margin: 0,
              fontWeight: 650,
              color: '#0A2E5C',
            }}
          >
            Personalizing your support experience...
          </p>
          <div aria-label="Loading">
            <PersonalizingSpinner />
          </div>
        </div>
      )}
    </main>
  )
}
