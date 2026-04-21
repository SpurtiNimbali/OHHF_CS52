import React from 'react'

export type OnboardingProgressDotsProps = {
  totalSteps: number
  currentStep: number
  className?: string
  'aria-label'?: string
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}

export function OnboardingProgressDots({
  totalSteps,
  currentStep,
  className,
  'aria-label': ariaLabel = 'Onboarding progress',
}: OnboardingProgressDotsProps) {
  const safeTotalSteps = Math.max(0, Math.floor(totalSteps))
  const safeCurrentStep =
    safeTotalSteps <= 0 ? 0 : clamp(Math.floor(currentStep), 0, safeTotalSteps - 1)

  if (safeTotalSteps <= 0) return null

  return (
    <div
      className={className}
      role="progressbar"
      aria-label={ariaLabel}
      aria-valuemin={1}
      aria-valuemax={safeTotalSteps}
      aria-valuenow={safeCurrentStep + 1}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
      }}
    >
      {Array.from({ length: safeTotalSteps }).map((_, idx) => {
        const isActive = idx === safeCurrentStep
        return (
          <span
            key={idx}
            aria-hidden="true"
            style={{
              width: 8,
              height: 8,
              borderRadius: 9999,
              backgroundColor: isActive ? 'currentColor' : 'rgba(0, 0, 0, 0.2)',
              transition: 'background-color 150ms ease',
            }}
          />
        )
      })}
    </div>
  )
}
