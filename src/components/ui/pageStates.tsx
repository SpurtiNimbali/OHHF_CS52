import type { ReactNode } from 'react'

import { CARDEA_NAVY, CARDEA_MUTED } from '../../ui/cardeaTokens'

type LoadingProps = {
  label?: string
}

export function ResourcesPageLoading({ label = 'Loading…' }: LoadingProps) {
  return (
    <div
      className="flex min-h-[min(52vh,420px)] w-full flex-col items-center justify-center gap-4 px-4 py-16"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div
        className="h-10 w-10 animate-spin rounded-full border-2 border-[#c6d9e5] border-t-[#192b3f]"
        aria-hidden
      />
      <p className="text-center text-sm font-medium" style={{ color: CARDEA_MUTED }}>
        {label}
      </p>
    </div>
  )
}

type ErrorProps = {
  message: string
  onRetry?: () => void
  retryLabel?: string
}

export function ResourcesPageError({ message, onRetry, retryLabel = 'Try again' }: ErrorProps) {
  return (
    <div
      role="alert"
      className="flex min-h-[min(52vh,420px)] w-full flex-col items-center justify-center gap-5 px-4 py-16 text-center"
    >
      <p className="max-w-md text-base font-semibold leading-snug" style={{ color: CARDEA_NAVY }}>
        {message}
      </p>
      {onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          className="rounded-full border-2 px-5 py-2.5 text-sm font-semibold transition-colors hover:bg-white/80"
          style={{ borderColor: CARDEA_NAVY, color: CARDEA_NAVY }}
        >
          {retryLabel}
        </button>
      ) : null}
    </div>
  )
}

type EmptyProps = {
  title: string
  description?: string
  icon?: ReactNode
}

export function ResourcesPageEmpty({ title, description, icon }: EmptyProps) {
  return (
    <div className="flex min-h-[min(44vh,360px)] w-full flex-col items-center justify-center gap-3 px-4 py-16 text-center">
      {icon ? <div className="text-4xl leading-none opacity-90">{icon}</div> : null}
      <p className="max-w-md text-base font-semibold leading-snug" style={{ color: CARDEA_NAVY }}>
        {title}
      </p>
      {description ? (
        <p className="max-w-md text-sm leading-relaxed" style={{ color: CARDEA_MUTED }}>
          {description}
        </p>
      ) : null}
    </div>
  )
}
