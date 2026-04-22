import React, { useState } from 'react'
import { OnboardingProgressDots } from './components/OnboardingProgressDots'

export function WelcomeScreen() {
  const [step, setStep] = useState<'welcome' | 'child-age'>('welcome')
  const [childAge, setChildAge] = useState<string | null>(null)

  const ageOptions = ['Prenatal', '0-1', '1–3', '4–7', '8–12', '13+'] as const

  return (
    <main
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 24,
        textAlign: 'center',
        color: '#0A2E5C',
        gap: 14,
        fontFamily: 'Inter, sans-serif',
      }}
    >
      {step === 'welcome' ? (
        <>
          <h1 style={{ fontSize: 44, lineHeight: 1.1, margin: 0, fontWeight: 750 }}>
            Welcome
          </h1>
          <p style={{ fontSize: 22, lineHeight: 1.3, margin: 0, fontWeight: 600 }}>
            You are not alone in this journey
          </p>
          <p style={{ fontSize: 16, lineHeight: 1.5, margin: 0, maxWidth: 560 }}>
            Caring for a child with complex medical needs can feel overwhelming.
            <br />
            You don’t have to navigate it alone.
            <br />
            This space is here to support you — gently and at your pace.
          </p>

          <button
            type="button"
            onClick={() => setStep('child-age')}
            style={{
              marginTop: 10,
              border: 'none',
              background: '#0A2E5C',
              color: '#FFFFFF',
              padding: '12px 18px',
              borderRadius: 12,
              fontSize: 16,
              fontWeight: 650,
              cursor: 'pointer',
            }}
          >
            Continue
          </button>

          <div style={{ marginTop: 18 }}>
            <OnboardingProgressDots totalSteps={2} currentStep={0} />
          </div>
        </>
      ) : (
        <>
          <h1 style={{ fontSize: 32, lineHeight: 1.15, margin: 0, fontWeight: 750 }}>
            How old is your child?
          </h1>
          <p style={{ fontSize: 22, lineHeight: 1.3, margin: 0, fontWeight: 600 }}>
            This helps us tailor resources and support to your caregiving stage.
          </p>

          <div
            style={{
              marginTop: 8,
              width: '100%',
              maxWidth: 520,
              display: 'grid',
              gridTemplateColumns: 'repeat(1, minmax(0, 1fr))',
              gap: 10,
            }}
          >
            {ageOptions.map((label) => {
              const selected = childAge === label
              return (
                <button
                  key={label}
                  type="button"
                  onClick={() => setChildAge(label)}
                  style={{
                    borderRadius: 12,
                    padding: '12px 10px',
                    fontSize: 14,
                    fontWeight: 650,
                    cursor: 'pointer',
                    border: selected ? '2px solid #0A2E5C' : '1px solid rgba(10, 46, 92, 0.25)',
                    background: selected ? 'rgba(10, 46, 92, 0.08)' : '#FFFFFF',
                    color: '#0A2E5C',
                  }}
                >
                  {label}
                </button>
              )
            })}
          </div>

          <div style={{ marginTop: 18 }}>
            <OnboardingProgressDots totalSteps={2} currentStep={1} />
          </div>
        </>
      )}
    </main>
  )
}