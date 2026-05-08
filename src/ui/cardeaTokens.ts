import type { CSSProperties } from 'react'

/** Core Cardea / resources palette (aligned across home, resources, glossary, support, questions). */
export const CARDEA_NAVY = '#192b3f'
export const CARDEA_LIGHT_BLUE = '#c6d9e5'
export const CARDEA_MUTED = '#acb7a8'
export const CARDEA_DARK_GREEN = '#577568'
export const CARDEA_ALMOST_WHITE = '#f5f9f9'

export const CARDEA_FONT_PRIMARY =
  'Inter, -apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif' as const
export const CARDEA_FONT_MONTSERRAT_STACK =
  "'Montserrat', Inter, system-ui, sans-serif" as const
/** Medical glossary / prose stack */
export const CARDEA_FONT_SANS =
  "'Inter', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" as const

export const CARDEA_BORDER_SOFT = 'rgba(25, 43, 63, 0.1)'
export const CARDEA_RADIUS_CARD = 14

export const cardeaCategoryBadgeSupport: CSSProperties = {
  flexShrink: 0,
  fontSize: '0.6875rem',
  fontWeight: 600,
  background: 'rgba(245, 249, 249, 0.98)',
  color: 'rgba(25, 43, 63, 0.8)',
  padding: '5px 11px',
  borderRadius: '100px',
  fontFamily: 'Inter, system-ui, sans-serif',
  letterSpacing: '0.02em',
  border: '1px solid rgba(25, 43, 63, 0.08)',
}

export const cardeaCategoryBadgeGlossary: CSSProperties = {
  flexShrink: 0,
  background: 'rgba(245, 249, 249, 0.95)',
  color: 'rgba(25, 43, 63, 0.75)',
  padding: '6px 12px',
  borderRadius: 999,
  fontSize: '0.6875rem',
  fontWeight: 600,
  border: '1px solid rgba(25, 43, 63, 0.08)',
  textTransform: 'capitalize',
}
