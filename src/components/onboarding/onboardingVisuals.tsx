import type { ReactNode } from 'react'
import { CARDEA_DARK_GREEN, CARDEA_LIGHT_BLUE, CARDEA_NAVY } from '../../ui/cardeaTokens'

export type OnboardingVisualVariant = 'welcome' | 'timeline' | 'growth' | 'constellation'

export function OnboardingAmbientOrbs() {
  return (
    <div className="pointer-events-none fixed inset-0 overflow-hidden" aria-hidden>
      <div
        className="absolute -left-16 top-24 h-56 w-56 rounded-full blur-3xl"
        style={{ background: `${CARDEA_LIGHT_BLUE}55` }}
      />
      <div
        className="absolute -right-10 top-1/3 h-48 w-48 rounded-full blur-3xl"
        style={{ background: `${CARDEA_DARK_GREEN}22` }}
      />
      <div
        className="absolute bottom-16 left-1/4 h-40 w-40 rounded-full blur-3xl"
        style={{ background: `${CARDEA_LIGHT_BLUE}40` }}
      />
    </div>
  )
}

function BannerFrame({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={`relative overflow-hidden rounded-2xl ${className}`.trim()}
      style={{ background: `linear-gradient(135deg, ${CARDEA_LIGHT_BLUE}55, rgba(245,249,249,0.95) 58%, rgba(87,117,104,0.12))` }}
    >
      <svg viewBox="0 0 400 120" className="h-full w-full" preserveAspectRatio="xMidYMid slice" aria-hidden>
        {children}
      </svg>
    </div>
  )
}

export function OnboardingStepBanner({ variant }: { variant: OnboardingVisualVariant }) {
  if (variant === 'welcome') {
    return (
      <BannerFrame className="mb-5 h-28 sm:h-32">
        <rect width="400" height="120" fill="url(#ob-welcome-sky)" />
        <defs>
          <linearGradient id="ob-welcome-sky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#dbe8ef" />
            <stop offset="100%" stopColor="#eef4f6" />
          </linearGradient>
        </defs>
        <path
          d="M0 88 Q100 72 200 80 T400 84 L400 120 L0 120 Z"
          fill={CARDEA_DARK_GREEN}
          opacity="0.18"
        />
        <path d="M0 96 Q120 86 220 92 T400 96 L400 120 L0 120 Z" fill={CARDEA_DARK_GREEN} opacity="0.1" />
        <circle cx="200" cy="52" r="18" fill="#f4e8c8" opacity="0.85" />
        <path
          d="M200 68 C200 68 178 52 178 40 C178 32 184 28 190 28 C194 28 198 32 200 36 C202 32 206 28 210 28 C216 28 222 32 222 40 C222 52 200 68 200 68 Z"
          fill={CARDEA_DARK_GREEN}
          opacity="0.75"
        />
        <path
          d="M72 92 L128 92"
          stroke={CARDEA_NAVY}
          strokeWidth="2"
          strokeLinecap="round"
          opacity="0.15"
        />
        <path
          d="M272 92 L328 92"
          stroke={CARDEA_NAVY}
          strokeWidth="2"
          strokeLinecap="round"
          opacity="0.15"
        />
      </BannerFrame>
    )
  }

  if (variant === 'timeline') {
    return (
      <BannerFrame className="mb-4 h-24">
        <rect width="400" height="120" fill="#eef4f6" />
        <path d="M48 64 H352" stroke={CARDEA_LIGHT_BLUE} strokeWidth="3" strokeLinecap="round" />
        {[80, 160, 240, 320].map((x, i) => (
          <circle
            key={x}
            cx={x}
            cy={64}
            r={i === 1 ? 10 : 7}
            fill={i === 1 ? CARDEA_DARK_GREEN : '#fff'}
            stroke={CARDEA_DARK_GREEN}
            strokeWidth="2"
            opacity={i === 1 ? 1 : 0.55}
          />
        ))}
        <circle cx="80" cy="64" r="3" fill={CARDEA_DARK_GREEN} opacity="0.5" />
      </BannerFrame>
    )
  }

  if (variant === 'growth') {
    return (
      <BannerFrame className="mb-4 h-24">
        <rect width="400" height="120" fill="#eef4f6" />
        <path d="M0 92 Q80 78 160 86 T320 82 L400 88 L400 120 L0 120 Z" fill={CARDEA_DARK_GREEN} opacity="0.14" />
        <path d="M120 92 V58" stroke={CARDEA_DARK_GREEN} strokeWidth="2.5" strokeLinecap="round" opacity="0.45" />
        <circle cx="120" cy="50" r="9" fill={CARDEA_DARK_GREEN} opacity="0.35" />
        <path d="M200 92 V44" stroke={CARDEA_DARK_GREEN} strokeWidth="2.5" strokeLinecap="round" opacity="0.65" />
        <circle cx="200" cy="36" r="11" fill={CARDEA_DARK_GREEN} opacity="0.5" />
        <path d="M280 92 V66" stroke={CARDEA_DARK_GREEN} strokeWidth="2.5" strokeLinecap="round" opacity="0.35" />
        <circle cx="280" cy="58" r="8" fill={CARDEA_DARK_GREEN} opacity="0.28" />
      </BannerFrame>
    )
  }

  if (variant === 'constellation') {
    return (
      <BannerFrame className="mb-4 h-24">
        <rect width="400" height="120" fill="#eef4f6" />
        {[
          [90, 48],
          [160, 72],
          [240, 44],
          [310, 68],
          [200, 58],
        ].map(([x, y], i) => (
          <circle key={i} cx={x} cy={y} r={i === 4 ? 9 : 6} fill="#fff" stroke={CARDEA_DARK_GREEN} strokeWidth="2" opacity="0.85" />
        ))}
        <path
          d="M90 48 L160 72 L200 58 L240 44 L310 68"
          fill="none"
          stroke={CARDEA_DARK_GREEN}
          strokeWidth="1.5"
          opacity="0.25"
        />
      </BannerFrame>
    )
  }

  return null
}

export function WelcomeReassuranceRow() {
  const items = ['At your pace', 'Private & gentle', 'For caregivers'] as const

  return (
    <div className="mb-2 flex flex-wrap justify-center gap-2">
      {items.map((label) => (
        <span
          key={label}
          className="rounded-full border bg-white/80 px-3 py-1.5 text-xs font-semibold shadow-sm"
          style={{ borderColor: 'rgba(25,43,63,0.08)', color: CARDEA_DARK_GREEN }}
        >
          {label}
        </span>
      ))}
    </div>
  )
}

export function CategoryAccent({ categoryId }: { categoryId: string }) {
  const common = 'shrink-0 rounded-xl p-2'
  const bg = { background: 'rgba(87, 117, 104, 0.1)' }

  const icons: Record<string, ReactNode> = {
    heart: (
      <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden>
        <path
          d="M10 16 C10 16 4 12 4 8 C4 5.5 6 4 8 4 C9 4 10 5.5 10 5.5 C10 5.5 11 4 12 4 C14 4 16 5.5 16 8 C16 12 10 16 10 16 Z"
          fill="none"
          stroke={CARDEA_DARK_GREEN}
          strokeWidth="1.5"
        />
      </svg>
    ),
    nicu: (
      <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden>
        <path d="M4 14 H16 V10 H4 Z" fill="none" stroke={CARDEA_DARK_GREEN} strokeWidth="1.5" />
        <path d="M7 10 V7 H13 V10" fill="none" stroke={CARDEA_DARK_GREEN} strokeWidth="1.5" />
      </svg>
    ),
    genetic: (
      <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden>
        <path d="M6 4 C10 4 10 10 14 10 C10 10 10 16 6 16" fill="none" stroke={CARDEA_DARK_GREEN} strokeWidth="1.5" />
      </svg>
    ),
    'mental-health': (
      <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden>
        <path d="M3 11 Q7 7 10 11 T17 11" fill="none" stroke={CARDEA_DARK_GREEN} strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    ),
    neurodevelopmental: (
      <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden>
        <path d="M10 16 V8 M10 8 L6 10 M10 8 L14 10" fill="none" stroke={CARDEA_DARK_GREEN} strokeWidth="1.5" strokeLinecap="round" />
        <circle cx="10" cy="5" r="2" fill={CARDEA_DARK_GREEN} opacity="0.45" />
      </svg>
    ),
  }

  return (
    <span className={common} style={bg}>
      {icons[categoryId] ?? icons.heart}
    </span>
  )
}
