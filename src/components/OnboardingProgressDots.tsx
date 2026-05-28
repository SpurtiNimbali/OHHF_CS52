import {
  CARDEA_DARK_GREEN,
  CARDEA_MUTED,
} from '../ui/cardeaTokens'

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
  className = '',
  'aria-label': ariaLabel = 'Onboarding progress',
}: OnboardingProgressDotsProps) {
  const safeTotalSteps = Math.max(0, Math.floor(totalSteps))
  const safeCurrentStep =
    safeTotalSteps <= 0 ? 0 : clamp(Math.floor(currentStep), 0, safeTotalSteps - 1)

  if (safeTotalSteps <= 0) return null

  return (
    <div
      className={`flex items-center justify-center gap-2 ${className}`.trim()}
      role="progressbar"
      aria-label={ariaLabel}
      aria-valuemin={1}
      aria-valuemax={safeTotalSteps}
      aria-valuenow={safeCurrentStep + 1}
    >
      {Array.from({ length: safeTotalSteps }).map((_, idx) => {
        const isActive = idx === safeCurrentStep
        return (
          <span
            key={idx}
            aria-hidden="true"
            className="h-2 w-2 rounded-full transition-colors duration-150"
            style={{
              backgroundColor: isActive ? CARDEA_DARK_GREEN : `${CARDEA_MUTED}55`,
            }}
          />
        )
      })}
    </div>
  )
}
